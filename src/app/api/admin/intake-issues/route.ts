import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/requireSession';
import clientPromise from '@/lib/mongodb';
import { INTAKE_FIX_ROLES } from '@/lib/intakeVisitFix';
import { detectIntakeIssuesFromStudent } from '@/lib/intakeIssues';
import { normalizeIntakeSessions, type IntakeSession } from '@/lib/intakeSession';

export async function GET() {
  const auth = await requireRole(INTAKE_FIX_ROLES);
  if (!auth.ok) return auth.response;
  const role = auth.user.role;
  const school = auth.user.school;

  const client = await clientPromise;
  const db = client.db('student-label');

  const query: Record<string, unknown> = {
    $or: [
      { intakeVisits: { $exists: true, $not: { $size: 0 } } },
      { timeIn: { $exists: true, $nin: [null, ''] } },
    ],
  };
  if (role !== 'Admin' && school) {
    query.school = school;
  }

  const students = await db.collection('students')
    .find(query)
    .project({
      firstName: 1,
      lastName: 1,
      school: 1,
      labelId: 1,
      createdAt: 1,
      timeIn: 1,
      timeOut: 1,
      isLeaving: 1,
      intakeSession: 1,
      intakeVisits: 1,
    })
    .sort({ updatedAt: -1, createdAt: -1 })
    .limit(500)
    .toArray();

  const schoolDocs = await db.collection('school_config')
    .find({})
    .project({ name: 1, intakeSessions: 1 })
    .toArray();

  const schoolSessionMap: Record<string, IntakeSession[]> = {};
  for (const doc of schoolDocs) {
    if (typeof doc.name !== 'string') continue;
    const sessions = normalizeIntakeSessions(doc.intakeSessions);
    if (sessions.length) schoolSessionMap[doc.name] = sessions;
  }

  const issues = students
    .map(doc => detectIntakeIssuesFromStudent(doc, { schoolSessionMap }))
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .slice(0, 100);

  return NextResponse.json({
    count: issues.length,
    issues,
  });
}
