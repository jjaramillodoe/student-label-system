/**
 * POST /api/admin/email-validation/sync
 *
 * Efficiently polls only PENDING + IN_PROGRESS jobs:
 *   1. Grab all local jobs with status PENDING or IN_PROGRESS.
 *   2. Fetch from emailawesome filtered to those same statuses (much smaller payload).
 *   3. Match by validationId (fast path) → fallback by email address (for legacy null-id records).
 *   4. Update status, emailStatus, and repair any null validationIds.
 */

import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';

const API_BASE = 'https://api.emailawesome.com/api/validations/email_validation';
const API_KEY  = process.env.EMAIL_VALIDATION_API_KEY ?? '';
const PAGE_SIZE = 50; // API maximum

async function fetchRemoteByStatus(status: string): Promise<any[]> {
  const results: any[] = [];
  let pageNum = 1;
  while (true) {
    const url = `${API_BASE}?status=${status}&page_number=${pageNum}&page_size=${PAGE_SIZE}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'x-api-key': API_KEY },
    });
    if (!res.ok) {
      console.error(`[sync] fetch ${status} page ${pageNum} failed:`, res.status, await res.text());
      break;
    }
    const data = await res.json();
    const page: any[] = data.results ?? [];
    results.push(...page);
    if (page.length < PAGE_SIZE) break;
    pageNum++;
  }
  return results;
}

export async function POST() {
  const session = await getServerSession(authOptions);
  const role    = (session?.user as any)?.role;
  const school  = (session?.user as any)?.school;
  if (!session || !['Admin', 'Data Lead'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const client = await clientPromise;
  const db = client.db('student-label');

  // ── 1. Load our local pending/in-progress jobs ────────────────────────────
  const schoolFilter: Record<string, any> = role !== 'Admin' ? { school } : {};
  const localJobs = await db.collection('email_validation_jobs')
    .find({ status: { $in: ['PENDING', 'IN_PROGRESS'] }, ...schoolFilter })
    .project({ _id: 1, validationId: 1, email: 1, status: 1, emailStatus: 1 })
    .toArray();

  console.log(`[sync] ${localJobs.length} local jobs to check`);
  if (localJobs.length === 0) {
    return NextResponse.json({ updated: 0, total: 0, message: 'No pending jobs.' });
  }

  // ── 2. Fetch only PENDING + IN_PROGRESS from emailawesome ─────────────────
  // This is much cheaper than fetching all 50+ records
  const [remotePending, remoteInProgress] = await Promise.all([
    fetchRemoteByStatus('PENDING'),
    fetchRemoteByStatus('IN_PROGRESS'),
  ]);
  // Also fetch COMPLETE records whose IDs we have locally
  // (jobs that finished since the last sync)
  const remoteComplete = await fetchRemoteByStatus('COMPLETE');

  const allRemote = [...remotePending, ...remoteInProgress, ...remoteComplete];
  console.log(`[sync] fetched ${allRemote.length} remote records (${remotePending.length} PENDING, ${remoteInProgress.length} IN_PROGRESS, ${remoteComplete.length} COMPLETE)`);

  // ── 3. Build lookup maps ──────────────────────────────────────────────────
  const byId    = new Map<string, any>(allRemote.filter(r => r.id).map(r => [r.id, r]));

  // For email fallback: keep the most recently modified entry per address
  const byEmail = new Map<string, any>();
  for (const r of allRemote) {
    const addr = r.email_address?.toLowerCase();
    if (!addr) continue;
    const existing = byEmail.get(addr);
    if (!existing || r.last_modification_date > existing.last_modification_date) {
      byEmail.set(addr, r);
    }
  }

  // ── 4. Update local jobs ──────────────────────────────────────────────────
  let updated = 0;
  const now = new Date().toISOString();

  for (const job of localJobs) {
    // ID match first (fast), then email fallback (for legacy records with null validationId)
    const remote = (job.validationId ? byId.get(job.validationId) : null)
      ?? byEmail.get(job.email?.toLowerCase());

    if (!remote) {
      console.log(`[sync] no remote match for email=${job.email} id=${job.validationId}`);
      continue;
    }

    const patch: Record<string, any> = {
      status:       remote.status,
      emailStatus:  remote.email_address_status,
    };

    // Repair null validationId from old broken submissions
    if (!job.validationId && remote.id) patch.validationId = remote.id;

    if (remote.status === 'COMPLETE') patch.completedAt = now;

    await db.collection('email_validation_jobs').updateOne(
      { _id: job._id },
      { $set: patch },
    );

    console.log(`[sync] ${job.email} → ${remote.status} / ${remote.email_address_status}`);
    updated++;
  }

  return NextResponse.json({ updated, total: localJobs.length });
}
