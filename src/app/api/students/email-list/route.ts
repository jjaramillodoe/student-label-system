/**
 * GET /api/students/email-list
 *
 * Returns a paginated list of students for the email validation picker.
 * Query params:
 *   page         — page number (default 1)
 *   q            — search by name
 *   emailFilter  — has_email | not_validated | invalid | all
 */

import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role   = (session?.user as any)?.role;
  const school = (session?.user as any)?.school;
  if (!session || !['Admin', 'Data Lead'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const client = await clientPromise;
  const db = client.db('student-label');

  const p     = parseInt(req.nextUrl.searchParams.get('page') ?? '1', 10);
  const limit = 50;
  const q     = req.nextUrl.searchParams.get('q') ?? '';
  const emailFilter = req.nextUrl.searchParams.get('emailFilter') ?? 'has_email';

  const query: Record<string, any> = role !== 'Admin' ? { school } : {};

  // Email filter
  if (emailFilter === 'has_email') {
    query.email = { $exists: true, $nin: [null, ''] };
  } else if (emailFilter === 'not_validated') {
    query.email = { $exists: true, $nin: [null, ''] };
    query.emailValidationStatus = { $exists: false };
  } else if (emailFilter === 'invalid') {
    query.emailValidationStatus = 'INVALID';
  }
  // 'all' — no extra filter

  // Text search
  if (q) {
    const re = { $regex: q, $options: 'i' };
    query.$or = [{ firstName: re }, { lastName: re }, { email: re }];
  }

  // Exclude students whose email is already in an active or completed job
  // (i.e. has a job that hasn't been applied to the student record yet)
  const activeJobEmails = await db.collection('email_validation_jobs')
    .distinct('email', {
      ...( role !== 'Admin' ? { school } : {} ),
      $or: [
        { status: 'IN_PROGRESS' },
        { status: 'COMPLETE', appliedAt: { $exists: false } },
      ],
    });

  if (activeJobEmails.length > 0) {
    const lowerActive = activeJobEmails.map((e: string) => e.toLowerCase());
    // Exclude these from the results
    query.email = {
      ...(query.email ?? {}),
      $nin: lowerActive,
    };
  }

  const total = await db.collection('students').countDocuments(query);
  const students = await db.collection('students')
    .find(query)
    .sort({ lastName: 1, firstName: 1 })
    .skip((p - 1) * limit)
    .limit(limit)
    .project({
      firstName: 1, lastName: 1, email: 1, school: 1,
      labelId: 1, studentId: 1,
      emailValidationStatus: 1, emailValidatedAt: 1,
    })
    .toArray();

  return NextResponse.json({
    students: students.map(s => ({ ...s, _id: s._id.toString() })),
    total,
    page: p,
    pages: Math.ceil(total / limit),
    excluded: activeJobEmails.length,
  });
}
