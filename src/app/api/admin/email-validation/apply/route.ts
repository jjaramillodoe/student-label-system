/**
 * POST /api/admin/email-validation/apply
 *
 * Writes the emailawesome validation results back to the student records.
 *
 * Body: { jobIds?: string[] }   — if omitted, applies ALL completed jobs
 *
 * Sets on each student:
 *   emailValidationStatus: 'VALID' | 'INVALID' | 'UNKNOWN'
 *   emailValidatedAt: ISO string
 */

import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { ObjectId } from 'mongodb';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role    = (session?.user as any)?.role;
  const school  = (session?.user as any)?.school;
  if (!session || role !== 'Admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const jobIds: string[] | undefined = body.jobIds;

  const client = await clientPromise;
  const db = client.db('student-label');

  const schoolFilter: Record<string, any> = role !== 'Admin' ? { school } : {};

  // Fetch completed jobs to apply
  const jobQuery: Record<string, any> = {
    status: 'COMPLETE',
    emailStatus: { $in: ['VALID', 'INVALID'] },
    appliedAt: { $exists: false }, // not yet applied
    ...schoolFilter,
  };
  if (jobIds && jobIds.length > 0) {
    jobQuery._id = { $in: jobIds.map(id => new ObjectId(id)) };
  }

  const jobs = await db.collection('email_validation_jobs').find(jobQuery).toArray();
  if (jobs.length === 0) {
    return NextResponse.json({ applied: 0, message: 'No completed jobs ready to apply.' });
  }

  const now = new Date().toISOString();
  let applied = 0;

  for (const job of jobs) {
    try {
      const studentOid = new ObjectId(job.studentDbId);
      await db.collection('students').updateOne(
        { _id: studentOid },
        {
          $set: {
            emailValidationStatus: job.emailStatus,
            emailValidatedAt:      now,
          },
        },
      );
      await db.collection('email_validation_jobs').updateOne(
        { _id: job._id },
        { $set: { appliedAt: now } },
      );
      applied++;
    } catch {
      // continue on individual failures
    }
  }

  return NextResponse.json({ applied, total: jobs.length });
}
