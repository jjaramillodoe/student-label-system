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
import { getSchoolIntakeSessions, validateIntakeSessionTimes } from '@/lib/intakeSession';
import { syncTopLevelIntakeFields } from '@/lib/intakeVisitFix';
import { normalizeMongoId, serializeMongoDocument } from '@/lib/utils';

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

    const authSession = await getServerSession(authOptions);
    const schoolIntakeSessions = authSession
      ? await getSchoolIntakeSessions(db, student.school)
      : undefined;

    return NextResponse.json({
      ...student,
      schoolIntakeSessions,
    });
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
    const session = await getServerSession(authOptions);
    const userSchool = (session?.user as { school?: string })?.school;
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

    if (oldStudent && (normalizeMongoId(oldStudent.cabinet) !== normalizeMongoId(body.cabinet)
      || String(oldStudent.drawer ?? '') !== String(body.drawer ?? ''))) {
      // Decrease count in old cabinet if it exists
      if (oldStudent.cabinet && oldStudent.drawer) {
        const oldCabinetId = normalizeMongoId(oldStudent.cabinet);
        if (!oldCabinetId || !isValidObjectId(oldCabinetId)) {
          return NextResponse.json({ error: 'Invalid old cabinet ID format' }, { status: 400 });
        }

        await db.collection('cabinets').updateOne(
          { 
            _id: new ObjectId(oldCabinetId),
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
        const newCabinetId = normalizeMongoId(body.cabinet);
        if (!newCabinetId || !isValidObjectId(newCabinetId)) {
          return NextResponse.json({ error: 'Invalid new cabinet ID format' }, { status: 400 });
        }

        const cabinetDoc = await db.collection('cabinets').findOne({ _id: new ObjectId(newCabinetId) });
        if (!cabinetDoc) {
          return NextResponse.json({ error: 'New cabinet not found' }, { status: 404 });
        }

        const drawers = Array.isArray(cabinetDoc.drawers) ? cabinetDoc.drawers : [];
        const drawerIndex = drawers.findIndex((d: { _id?: string }) => d._id === body.drawer);
        if (drawerIndex === -1) {
          return NextResponse.json({ error: 'New drawer not found in cabinet' }, { status: 404 });
        }

        const drawerCapacity = drawers[drawerIndex].capacity;
        const currentCount = drawers[drawerIndex].currentCount || 0;

        if (currentCount >= drawerCapacity) {
          return NextResponse.json({ error: 'New drawer is at full capacity' }, { status: 400 });
        }

        await db.collection('cabinets').updateOne(
          { 
            _id: new ObjectId(newCabinetId),
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
      const sessions = await getSchoolIntakeSessions(db, userSchool || oldStudent.school);
      const sessionTimeError = validateIntakeSessionTimes({
        intakeSession: appendVisit.intakeSession,
        timeIn: appendVisit.timeIn,
        timeOut: appendVisit.timeOut,
        sessions,
      });
      if (sessionTimeError) {
        return NextResponse.json({ error: sessionTimeError }, { status: 400 });
      }

      const existingVisits = Array.isArray(oldStudent.intakeVisits)
        ? [...oldStudent.intakeVisits]
        : oldStudent.intakeVisits && typeof oldStudent.intakeVisits === 'object'
          ? [oldStudent.intakeVisits]
          : oldStudent.timeIn
            ? [{
                date: oldStudent.createdAt,
                timeIn: oldStudent.timeIn,
                timeOut: oldStudent.timeOut ?? null,
                isLeaving: oldStudent.isLeaving,
                intakeSession: oldStudent.intakeSession,
                intakeActivity: oldStudent.intakeActivity,
                recordedBy: oldStudent.createdBy,
              }]
            : [];

      const nextVisits = [...existingVisits, appendVisit];
      update.$set = {
        ...update.$set,
        intakeVisits: nextVisits,
        ...syncTopLevelIntakeFields(nextVisits),
      };
    }

    const result = await db.collection('students').findOneAndUpdate(
      { _id: new ObjectId(id) },
      update,
      { returnDocument: 'after' }
    );
    if (!result) return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    return NextResponse.json(serializeMongoDocument(result as Record<string, unknown>));
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