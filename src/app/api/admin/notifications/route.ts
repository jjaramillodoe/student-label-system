import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrDataLead } from '@/lib/requireSession';
import clientPromise from '@/lib/mongodb';
import { isEmailConfigured } from '@/lib/email';
import {
  getNotificationSettings,
  resolveNotificationRecipients,
  sendIntakeIssuesDigest,
  sendTestNotificationEmail,
} from '@/lib/notifications';
import { detectIntakeIssuesFromStudent } from '@/lib/intakeIssues';
import { normalizeIntakeSessions, type IntakeSession } from '@/lib/intakeSession';
import { formatFullName } from '@/lib/personName';

async function collectIntakeIssues() {
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

  return students
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
}

/** POST { action: 'test' | 'intake-digest' | 'status' } — Admin/Data Lead only */
export async function POST(req: NextRequest) {
  const auth = await requireAdminOrDataLead();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const action = body.action as string;
  const client = await clientPromise;
  const db = client.db('student-label');

  if (action === 'status') {
    const settings = await getNotificationSettings(db);
    const recipients = await resolveNotificationRecipients(db, settings);
    return NextResponse.json({
      emailConfigured: isEmailConfigured(),
      settings,
      recipientCount: recipients.length,
      recipientsPreview: recipients.slice(0, 8),
    });
  }

  if (action === 'test') {
    const to =
      (typeof body.to === 'string' && body.to.trim()) ||
      auth.user?.email ||
      '';
    if (!to) {
      return NextResponse.json({ error: 'No recipient email' }, { status: 400 });
    }
    const result = await sendTestNotificationEmail(to);
    if (!result.ok) {
      return NextResponse.json({ error: result.error || 'Send failed', skipped: result.skipped }, { status: 400 });
    }
    return NextResponse.json({ ok: true, to });
  }

  if (action === 'intake-digest') {
    const issues = await collectIntakeIssues();
    const result = await sendIntakeIssuesDigest(db, issues);
    if (!result.sent) {
      return NextResponse.json({
        ok: false,
        reason: result.reason,
        issueCount: issues.length,
      });
    }
    return NextResponse.json({
      ok: true,
      issueCount: issues.length,
      recipientCount: result.recipientCount,
    });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
