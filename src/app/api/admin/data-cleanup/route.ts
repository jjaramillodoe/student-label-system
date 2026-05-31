import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { authOptions } from '@/lib/authOptions';

type CleanupStudent = {
  _id: ObjectId;
  firstName?: string;
  lastName?: string;
  studentId?: string;
  email?: string;
  dob?: string;
  startDate?: string;
  endDate?: string;
  fiscalYear?: string;
  status?: string;
  archived?: boolean;
  cabinet?: string;
  drawer?: string;
  school?: string;
};

const INACTIVE_STATUSES = new Set(['Inactive', 'Graduated', 'Withdrawn', 'Transferred']);

function isValidDate(value?: string) {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

function isValidEmail(value?: string) {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function serializeStudent(student: CleanupStudent, issue: string) {
  return {
    _id: student._id.toString(),
    studentId: student.studentId || '',
    name: `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Unnamed Student',
    email: student.email || '',
    dob: student.dob || '',
    startDate: student.startDate || '',
    endDate: student.endDate || '',
    fiscalYear: student.fiscalYear || '',
    status: student.status || '',
    archived: Boolean(student.archived),
    cabinet: student.cabinet || '',
    drawer: student.drawer || '',
    school: student.school || '',
    issue,
  };
}

async function decrementCabinetCounts(db: any, students: CleanupStudent[]) {
  for (const student of students) {
    if (!student.cabinet || !student.drawer || !ObjectId.isValid(student.cabinet)) continue;

    await db.collection('cabinets').updateOne(
      {
        _id: new ObjectId(student.cabinet),
        'drawers._id': student.drawer,
      },
      {
        $inc: {
          'drawers.$.currentCount': -1,
          currentCount: -1,
        },
      }
    );
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || !['Admin', 'Data Lead'].includes((session.user as any)?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const client = await clientPromise;
    const db = client.db('student-label');
    const userRole = (session.user as any)?.role;
    const userSchool = (session.user as any)?.school;
    const query = userRole === 'Admin' ? {} : { school: userSchool };
    const students = await db.collection('students').find(query).toArray() as CleanupStudent[];
    const oldInactiveCutoff = new Date();
    oldInactiveCutoff.setFullYear(oldInactiveCutoff.getFullYear() - 1);

    const invalidEmails = students
      .filter(student => student.email && !isValidEmail(student.email))
      .map(student => serializeStudent(student, 'Invalid email format'));

    const missingDates = students
      .filter(student => !isValidDate(student.dob) || !isValidDate(student.startDate))
      .map(student => {
        const missing = [
          !isValidDate(student.dob) ? 'DOB' : '',
          !isValidDate(student.startDate) ? 'start date' : '',
        ].filter(Boolean).join(' and ');
        return serializeStudent(student, `Missing or invalid ${missing}`);
      });

    const oldInactive = students
      .filter(student => {
        if (student.archived || !INACTIVE_STATUSES.has(student.status || '')) return false;
        const compareDate = student.endDate || student.startDate;
        return isValidDate(compareDate) && new Date(compareDate as string) < oldInactiveCutoff;
      })
      .map(student => serializeStudent(student, 'Inactive for more than 1 year and not archived'));

    const archivedAssigned = students
      .filter(student => student.archived && student.cabinet && student.drawer)
      .map(student => serializeStudent(student, 'Archived student still assigned to a cabinet/drawer'));

    return NextResponse.json({
      summary: {
        scanned: students.length,
        invalidEmails: invalidEmails.length,
        missingDates: missingDates.length,
        oldInactive: oldInactive.length,
        archivedAssigned: archivedAssigned.length,
        totalIssues: invalidEmails.length + missingDates.length + oldInactive.length + archivedAssigned.length,
      },
      invalidEmails,
      missingDates,
      oldInactive,
      archivedAssigned,
    });
  } catch (error) {
    console.error('Error scanning data cleanup issues:', error);
    return NextResponse.json({ error: 'Failed to scan data cleanup issues' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !['Admin', 'Data Lead'].includes((session.user as any)?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { action, ids } = await req.json();
    const objectIds = Array.isArray(ids)
      ? ids.filter((id: string) => ObjectId.isValid(id)).map((id: string) => new ObjectId(id))
      : [];

    if (!action || objectIds.length === 0) {
      return NextResponse.json({ error: 'Action and student IDs are required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('student-label');
    const userRole = (session.user as any)?.role;
    const userSchool = (session.user as any)?.school;
    const scopeQuery = userRole === 'Admin' ? {} : { school: userSchool };
    const scopedIdsQuery = { ...scopeQuery, _id: { $in: objectIds } };

    if (action === 'clear-invalid-emails') {
      const result = await db.collection('students').updateMany(
        scopedIdsQuery,
        { $unset: { email: '' }, $set: { updatedAt: new Date().toISOString() } }
      );

      return NextResponse.json({ success: true, updated: result.modifiedCount });
    }

    if (action === 'archive-old-inactive') {
      const result = await db.collection('students').updateMany(
        {
          ...scopedIdsQuery,
          status: { $in: Array.from(INACTIVE_STATUSES) },
        },
        {
          $set: {
            archived: true,
            updatedAt: new Date().toISOString(),
          },
        }
      );

      return NextResponse.json({ success: true, updated: result.modifiedCount });
    }

    if (action === 'unassign-archived') {
      const students = await db.collection('students').find({
        ...scopedIdsQuery,
        archived: true,
      }).toArray() as CleanupStudent[];

      await decrementCabinetCounts(db, students);
      const result = await db.collection('students').updateMany(
        {
          _id: { $in: students.map(student => student._id) },
        },
        {
          $unset: {
            cabinet: '',
            drawer: '',
          },
          $set: {
            updatedAt: new Date().toISOString(),
          },
        }
      );

      return NextResponse.json({ success: true, updated: result.modifiedCount });
    }

    return NextResponse.json({ error: 'Unknown cleanup action' }, { status: 400 });
  } catch (error) {
    console.error('Error running data cleanup action:', error);
    return NextResponse.json({ error: 'Failed to run cleanup action' }, { status: 500 });
  }
}
