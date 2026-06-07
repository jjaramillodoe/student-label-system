import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import {
  buildIntakeFixPreview,
  canFixIntakeHandoff,
  syncTopLevelIntakeFields,
  type FinalClockOutInput,
  type ClosingVisitInput,
} from '@/lib/intakeVisitFix';
import { validateIntakeVisits } from '@/lib/intakeVisitValidation';

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
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const school = (session?.user as { school?: string })?.school;
  const userEmail = (session?.user as { email?: string })?.email;

  if (!session || !canFixIntakeHandoff(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

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
    name: (session.user as { name?: string })?.name || userEmail || 'unknown',
  };
  const preview = buildIntakeFixPreview(
    sourceVisits,
    finalClockOuts,
    closingVisits,
    recordedBy,
  );
  const validation = validateIntakeVisits(preview.visits);

  if (validation.hasIssues && preview.stillNeedsFinalClockOut.length > 0) {
    return NextResponse.json({
      error: 'Still missing final Time Out on one or more days.',
      stillNeedsFinalClockOut: preview.stillNeedsFinalClockOut,
      previewChanges: preview.changes,
    }, { status: 400 });
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
          name: (session.user as { name?: string })?.name || userEmail || 'unknown',
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
    resolved: !validateIntakeVisits(preview.visits).hasIssues,
  });
}
