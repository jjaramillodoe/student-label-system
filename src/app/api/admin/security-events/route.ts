import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import clientPromise from '@/lib/mongodb';
import { AUTH_EVENTS_COLLECTION, listLockedAccounts } from '@/lib/authSecurity';

/**
 * GET /api/admin/security-events
 * Admin-only auth event feed (failed logins, MFA failures, successes).
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role !== 'Admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(Number(searchParams.get('limit') || 100), 1), 500);
  const type = (searchParams.get('type') || 'all').trim();
  const email = (searchParams.get('email') || '').trim().toLowerCase();
  const hours = Math.min(Math.max(Number(searchParams.get('hours') || 72), 1), 24 * 30);

  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const filter: Record<string, unknown> = { at: { $gte: since } };
  if (type !== 'all') filter.type = type;
  if (email) filter.email = { $regex: email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };

  const client = await clientPromise;
  const db = client.db('student-label');
  const col = db.collection(AUTH_EVENTS_COLLECTION);

  const [events, failureCount, mfaFailCount, successCount, lockedAccounts] = await Promise.all([
    col.find(filter).sort({ at: -1 }).limit(limit).toArray(),
    col.countDocuments({ at: { $gte: since }, type: { $in: ['login_failure', 'user_unknown'] } }),
    col.countDocuments({ at: { $gte: since }, type: 'mfa_failure' }),
    col.countDocuments({ at: { $gte: since }, type: 'login_success' }),
    listLockedAccounts(),
  ]);

  return NextResponse.json({
    since,
    hours,
    summary: {
      failures: failureCount,
      mfaFailures: mfaFailCount,
      successes: successCount,
      locked: lockedAccounts.length,
    },
    lockedAccounts,
    events: events.map((e) => ({
      ...e,
      _id: String(e._id),
    })),
  });
}
