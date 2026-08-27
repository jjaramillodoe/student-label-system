import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { sendIntakeIssuesDigest } from '@/lib/notifications';
import { detectIntakeIssuesFromStudent } from '@/lib/intakeIssues';
import { normalizeIntakeSessions, type IntakeSession } from '@/lib/intakeSession';
import { formatFullName } from '@/lib/personName';
import { isAuthorizedBySharedSecret } from '@/lib/secretCompare';

/**
 * Vercel Cron / external scheduler entrypoint.
 * Auth: Authorization: Bearer <CRON_SECRET>
 * Vercel Cron sends this header automatically when CRON_SECRET is set.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET || process.env.NOTIFICATION_CRON_SECRET;
  if (!isAuthorizedBySharedSecret(req.headers.get('authorization'), secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = await clientPromise;
  const db = client.db('student-label');

  const students = await db.collection('students')
    .find({
      $or: [
        { intakeVisits: { $exists: true, $not: { $size: 0 } } },
        { timeIn: { $exists: true, $nin: [null, ''] } },
      ],
    })
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
    .map(item => ({
      studentName: formatFullName(item),
      school: item.school,
      issues: [
        `${item.flagCount} flag(s)`,
        ...(item.dayLabels?.length ? [`days: ${item.dayLabels.join(', ')}`] : []),
      ],
    }));

  const result = await sendIntakeIssuesDigest(db, issues);
  return NextResponse.json({
    ok: result.sent,
    reason: result.reason,
    issueCount: issues.length,
    recipientCount: result.recipientCount,
  });
}
