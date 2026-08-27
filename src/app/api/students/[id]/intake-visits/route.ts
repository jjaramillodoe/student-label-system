import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/requireSession';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import {
  buildIntakeFixPreview,
  INTAKE_FIX_ROLES,
  syncTopLevelIntakeFields,
  type FinalClockOutInput,
  type ClosingVisitInput,
} from '@/lib/intakeVisitFix';
import { validateIntakeVisits } from '@/lib/intakeVisitValidation';
import { getSchoolIntakeSessions, validateIntakeSessionTimes } from '@/lib/intakeSession';

function isValidObjectId(id: string): boolean {
  try {
    new ObjectId(id);
    return true;
  } catch {
    return false;
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole(INTAKE_FIX_ROLES);
  if (!auth.ok) return auth.response;
  const role = auth.user.role;
  const school = auth.user.school;
  const userEmail = auth.user.email;

  const { id } = await params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: 'Invalid student ID' }, { status: 400 });
  }

  const body = await req.json() as {
    visits?: unknown[];
    finalClockOuts?: FinalClockOutInput[];
    closingVisits?: ClosingVisitInput[];
  };

  const client = await clientPromise;
  const db = client.db('student-label');
  const student = await db.collection('students').findOne({ _id: new ObjectId(id) });
  if (!student) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 });
  }

  if (role !== 'Admin' && school && student.school !== school) {
    return NextResponse.json({ error: 'Forbidden — student is outside your school' }, { status: 403 });
  }

  const existingVisits = Array.isArray(student.intakeVisits) ? student.intakeVisits : [];
  const sourceVisits = Array.isArray(body.visits) ? body.visits : existingVisits;
  const finalClockOuts = Array.isArray(body.finalClockOuts) ? body.finalClockOuts : [];
  const closingVisits = Array.isArray(body.closingVisits) ? body.closingVisits : [];

  const recordedBy = {
    email: userEmail || 'unknown',
    name: auth.user?.name || userEmail || 'unknown',
  };
  const sessionConfigs = await getSchoolIntakeSessions(db, student.school);
  const preview = buildIntakeFixPreview(
    sourceVisits,
    finalClockOuts,
    closingVisits,
    recordedBy,
  );

  for (const visit of preview.visits) {
    const sessionError = validateIntakeSessionTimes({
      intakeSession: visit.intakeSession,
      timeIn: visit.timeIn,
      timeOut: visit.timeOut,
      sessions: sessionConfigs,
    });
    if (sessionError) {
      return NextResponse.json({ error: sessionError }, { status: 400 });
    }
  }

  const validation = validateIntakeVisits(preview.visits, { sessionConfigs });

  if (validation.hasIssues && preview.stillNeedsFinalClockOut.length > 0) {
    return NextResponse.json({
      error: 'Still missing final Time Out on one or more days.',
      stillNeedsFinalClockOut: preview.stillNeedsFinalClockOut,
      previewChanges: preview.changes,
    }, { status: 400 });
  }

  if (validation.hasIssues) {
    const messages = validation.flags.map(f => f.message);
    return NextResponse.json({
      error: messages[0] || 'Intake visit issues remain.',
      issues: messages,
    }, { status: 400 });
  }

  const visitsChanged = JSON.stringify(preview.visits) !== JSON.stringify(existingVisits);
  if (!visitsChanged && preview.changes.length === 0) {
    return NextResponse.json({ error: 'Nothing to save.' }, { status: 400 });
  }

  const topLevel = syncTopLevelIntakeFields(preview.visits);
  const now = new Date().toISOString();

  const result = await db.collection('students').findOneAndUpdate(
    { _id: new ObjectId(id) },
    {
      $set: {
        intakeVisits: preview.visits,
        ...topLevel,
        updatedAt: now,
        intakeHandoffFixedAt: now,
        intakeHandoffFixedBy: {
          email: userEmail || 'unknown',
          name: auth.user?.name || userEmail || 'unknown',
        },
      },
    },
    { returnDocument: 'after' },
  );

  if (!result) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  return NextResponse.json({
    student: result,
    changes: preview.changes,
    resolved: !validateIntakeVisits(preview.visits, { sessionConfigs }).hasIssues,
  });
}
