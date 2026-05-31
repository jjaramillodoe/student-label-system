import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import {
  beEslAgeErrorMessage,
  checkBeEslAgeEligibility,
  requiresBeEslAgeCheck,
} from '@/lib/beEslEligibility';

// Helper function to validate ObjectId
function isValidObjectId(id: string): boolean {
  try {
    new ObjectId(id);
    return true;
  } catch (error) {
    return false;
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid student ID format' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("student-label");
    const student = await db.collection('students').findOne({ _id: new ObjectId(id) });
    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    return NextResponse.json(student);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch student' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid student ID format' }, { status: 400 });
    }

    const body = await req.json();
    const client = await clientPromise;
    const db = client.db("student-label");

    // If cabinet or drawer is being changed, update the old and new cabinet capacities
    const oldStudent = await db.collection('students').findOne({ _id: new ObjectId(id) });
    if (!oldStudent) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    const dobToCheck = body.dob || oldStudent.dob;
    if (
      requiresBeEslAgeCheck({
        intakeStudentStatus: body.intakeStudentStatus ?? oldStudent.intakeStudentStatus,
        educationStatus: body.educationStatus ?? oldStudent.educationStatus,
      })
      && dobToCheck
    ) {
      const ageCheck = checkBeEslAgeEligibility(String(dobToCheck));
      if (!ageCheck.eligible) {
        return NextResponse.json({ error: beEslAgeErrorMessage(ageCheck) }, { status: 400 });
      }
    }

    if (oldStudent && (oldStudent.cabinet !== body.cabinet || oldStudent.drawer !== body.drawer)) {
      // Decrease count in old cabinet if it exists
      if (oldStudent.cabinet && oldStudent.drawer) {
        if (!isValidObjectId(oldStudent.cabinet)) {
          return NextResponse.json({ error: 'Invalid old cabinet ID format' }, { status: 400 });
        }

        await db.collection('cabinets').updateOne(
          { 
            _id: new ObjectId(oldStudent.cabinet),
            'drawers._id': oldStudent.drawer
          },
          { 
            $inc: { 
              'drawers.$.currentCount': -1,
              'currentCount': -1
            }
          }
        );
      }

      // Increase count in new cabinet if provided
      if (body.cabinet && body.drawer) {
        if (!isValidObjectId(body.cabinet)) {
          return NextResponse.json({ error: 'Invalid new cabinet ID format' }, { status: 400 });
        }

        const cabinetDoc = await db.collection('cabinets').findOne({ _id: new ObjectId(body.cabinet) });
        if (!cabinetDoc) {
          return NextResponse.json({ error: 'New cabinet not found' }, { status: 404 });
        }

        const drawerIndex = cabinetDoc.drawers.findIndex((d: any) => d._id === body.drawer);
        if (drawerIndex === -1) {
          return NextResponse.json({ error: 'New drawer not found in cabinet' }, { status: 404 });
        }

        const drawerCapacity = cabinetDoc.drawers[drawerIndex].capacity;
        const currentCount = cabinetDoc.drawers[drawerIndex].currentCount || 0;

        if (currentCount >= drawerCapacity) {
          return NextResponse.json({ error: 'New drawer is at full capacity' }, { status: 400 });
        }

        await db.collection('cabinets').updateOne(
          { 
            _id: new ObjectId(body.cabinet),
            'drawers._id': body.drawer
          },
          { 
            $inc: { 
              'drawers.$.currentCount': 1,
              'currentCount': 1
            }
          }
        );
      }
    }

    // Extract a visit-log entry to append (don't $set it as a scalar field).
    const { appendVisit, reactivateFromArchive, ...setFields } = body as Record<string, any>;

    const update: Record<string, any> = {
      $set: { ...setFields, updatedAt: new Date().toISOString() },
    };

    if (reactivateFromArchive) {
      update.$unset = {
        archiveBoxId: '',
        archiveBoxLabel: '',
        archiveLocation: '',
        archiveId: '',
        archiveSchoolYear: '',
        archivedAt: '',
        archived: '',
      };
      update.$set.archived = false;
    }
    // Append a new intake visit to the time-log history instead of overwriting.
    if (appendVisit && typeof appendVisit === 'object') {
      update.$push = { intakeVisits: appendVisit };
    }

    const result = await db.collection('students').findOneAndUpdate(
      { _id: new ObjectId(id) },
      update,
      { returnDocument: 'after' }
    );
    if (!result) return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating student:', error);
    return NextResponse.json({ 
      error: 'Failed to update student',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Enforce role-based access
  const session = await getServerSession(authOptions);
  
  const role = (session?.user as any)?.role;
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized - No session' }, { status: 401 });
  }
  if (role !== 'Data Lead' && role !== 'Admin') {
    return NextResponse.json({ error: 'Forbidden - Insufficient role' }, { status: 403 });
  }
  try {
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid student ID format' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("student-label");

    // Get the student first to check if they're in a cabinet
    const student = await db.collection('students').findOne({ _id: new ObjectId(id) });
    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // If the student is in a cabinet, decrease the cabinet's count
    if (student.cabinet && student.drawer) {
      // Handle both ObjectId and string cabinet IDs
      let cabinetId;
      if (isValidObjectId(student.cabinet)) {
        cabinetId = new ObjectId(student.cabinet);
      } else {
        // If it's not a valid ObjectId, try to find the cabinet by name or other identifier
        const cabinet = await db.collection('cabinets').findOne({ name: student.cabinet });
        if (cabinet) {
          cabinetId = cabinet._id;
        }
      }

      if (cabinetId) {
        await db.collection('cabinets').updateOne(
          { 
            _id: cabinetId,
            'drawers._id': student.drawer
          },
          { 
            $inc: { 
              'drawers.$.currentCount': -1,
              'currentCount': -1
            }
          }
        );
      }
    }

    const result = await db.collection('students').deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting student:', error);
    return NextResponse.json({ 
      error: 'Failed to delete student',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 