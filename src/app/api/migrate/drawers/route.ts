import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { destructiveHttpGuard } from '@/lib/destructiveHttp';
import { requireAdminOrDataLead } from '@/lib/requireSession';

export async function POST(req: NextRequest) {
  const blocked = destructiveHttpGuard();
  if (blocked) return blocked;

  const auth = await requireAdminOrDataLead('Unauthorized');
  if (!auth.ok) return auth.response;

  try {
    const client = await clientPromise;
    const db = client.db("student-label");

    // Filter cabinets based on user role and school
    let cabinetQuery = {};
    const userRole = auth.user.role;
    const userSchool = auth.user.school;
    
    // Admins can migrate all cabinets, others are restricted to their school
    if (userRole !== 'Admin' && userSchool) {
      cabinetQuery = { school: userSchool };
    }

    // Get all cabinets (filtered by school if applicable)
    const cabinets = await db.collection('cabinets').find(cabinetQuery).toArray();
    const migrationResults = {
      totalStudents: 0,
      updatedStudents: 0,
      errors: [] as string[],
      updatedCabinets: 0,
    };

    // First, ensure all drawers have IDs
    for (const cabinet of cabinets) {
      let needsUpdate = false;
      const updatedDrawers = cabinet.drawers.map((drawer: any) => {
        if (!drawer._id) {
          needsUpdate = true;
          return {
            ...drawer,
            _id: new ObjectId().toString()
          };
        }
        return drawer;
      });

      if (needsUpdate) {
        await db.collection('cabinets').updateOne(
          { _id: cabinet._id },
          { $set: { drawers: updatedDrawers } }
        );
        migrationResults.updatedCabinets++;
      }
    }

    // Then process each cabinet's students
    for (const cabinet of cabinets) {
      // Create a map of drawer names to IDs for this cabinet
      const drawerMap = new Map(
        cabinet.drawers.map((drawer: any) => [drawer.name, drawer._id])
      );

      // Find all students in this cabinet
      const students = await db.collection('students').find({
        cabinet: cabinet._id.toString(),
      }).toArray();

      migrationResults.totalStudents += students.length;

      // Update each student's drawer reference
      for (const student of students) {
        try {
          const drawerId = drawerMap.get(student.drawer);
          if (!drawerId) {
            migrationResults.errors.push(
              `Student ${student._id}: Drawer "${student.drawer}" not found in cabinet ${cabinet._id}`
            );
            continue;
          }

          await db.collection('students').updateOne(
            { _id: student._id },
            { $set: { drawer: drawerId } }
          );
          migrationResults.updatedStudents++;
        } catch (error) {
          migrationResults.errors.push(
            `Error updating student ${student._id}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      results: migrationResults,
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({
      error: 'Migration failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
} 