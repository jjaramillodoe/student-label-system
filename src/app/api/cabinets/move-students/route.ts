import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (session.user as any)?.role;
    if (userRole !== 'Admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { fromCabinetId, toCabinetId } = body;

    if (!fromCabinetId || !toCabinetId) {
      return NextResponse.json({ error: 'Missing fromCabinetId or toCabinetId' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("student-label");

    // Get both cabinets
    const fromCabinet = await db.collection('cabinets').findOne({ _id: new ObjectId(fromCabinetId) });
    const toCabinet = await db.collection('cabinets').findOne({ _id: new ObjectId(toCabinetId) });

    if (!fromCabinet || !toCabinet) {
      return NextResponse.json({ error: 'Cabinet not found' }, { status: 404 });
    }

    // Calculate how many students need to be moved (over capacity)
    const overCapacity = Math.max(0, (fromCabinet.currentCount || 0) - (fromCabinet.totalCapacity || 0));
    
    if (overCapacity === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No students need to be moved - cabinet is not over capacity',
        moved: 0
      });
    }

    // Get all students from the source cabinet
    const students = await db.collection('students').find({
      cabinet: fromCabinetId
    }).toArray();

    // Limit to the over-capacity amount
    const studentsToMove = students.slice(0, overCapacity);

    if (studentsToMove.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No students found to move',
        moved: 0
      });
    }

    // Prepare drawer availability (calculate available space in each drawer)
    const drawerAvailability: { drawerId: string; capacity: number; currentCount: number; available: number }[] = [];
    for (const drawer of toCabinet.drawers || []) {
      const capacity = drawer.capacity || 0;
      const currentCount = drawer.currentCount || 0;
      const available = Math.max(0, capacity - currentCount);
      drawerAvailability.push({
        drawerId: drawer._id?.toString() || '',
        capacity,
        currentCount,
        available
      });
    }

    // Sort drawers by available space (descending)
    drawerAvailability.sort((a, b) => b.available - a.available);

    let movedCount = 0;
    const results = {
      moved: 0,
      skipped: 0,
      errors: [] as string[],
      drawerDistribution: {} as Record<string, number>
    };

    // Distribute students across available drawers
    for (const student of studentsToMove) {
      // Find the drawer with the most available space
      const availableDrawer = drawerAvailability.find(d => d.available > 0);

      if (!availableDrawer) {
        results.errors.push(`No available space in target cabinet for student ${student._id}`);
        results.skipped++;
        continue;
      }

      try {
        // Update student to new cabinet and drawer
        await db.collection('students').updateOne(
          { _id: student._id },
          { 
            $set: { 
              cabinet: toCabinetId,
              drawer: availableDrawer.drawerId,
              updatedAt: new Date().toISOString()
            }
          }
        );

        // Decrease count in old cabinet
        await db.collection('cabinets').updateOne(
          {
            _id: new ObjectId(fromCabinetId),
            'drawers._id': student.drawer
          },
          {
            $inc: {
              'drawers.$.currentCount': -1,
              currentCount: -1
            }
          }
        );

        // Increase count in new cabinet
        await db.collection('cabinets').updateOne(
          {
            _id: new ObjectId(toCabinetId),
            'drawers._id': availableDrawer.drawerId
          },
          {
            $inc: {
              'drawers.$.currentCount': 1,
              currentCount: 1
            }
          }
        );

        // Update availability tracking
        availableDrawer.available--;
        availableDrawer.currentCount++;
        results.drawerDistribution[availableDrawer.drawerId] = (results.drawerDistribution[availableDrawer.drawerId] || 0) + 1;
        movedCount++;

      } catch (error: any) {
        results.errors.push(`Error moving student ${student._id}: ${error.message}`);
        results.skipped++;
      }
    }

    results.moved = movedCount;

    return NextResponse.json({
      success: true,
      message: `Successfully moved ${movedCount} student(s) from "${fromCabinet.name}" to "${toCabinet.name}"`,
      results
    });

  } catch (error: any) {
    console.error('Error moving students:', error);
    return NextResponse.json({
      error: 'Failed to move students',
      details: error.message
    }, { status: 500 });
  }
}

