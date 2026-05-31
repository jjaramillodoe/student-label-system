/**
 * GET  /api/admin/email-validation
 *   Returns: current-month usage, quota, and all validation jobs for this school.
 *
 * POST /api/admin/email-validation
 *   Body: { studentIds: string[] }
 *   Submits each student's email to the emailawesome API, stores a job record,
 *   and increments the monthly usage counter.
 *   Enforces MONTHLY_QUOTA (1000) — rejects the batch if it would exceed the cap.
 */

import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { ObjectId } from 'mongodb';

const API_BASE = 'https://api.emailawesome.com/api/validations/email_validation';
const API_KEY  = process.env.EMAIL_VALIDATION_API_KEY ?? '';
const MONTHLY_QUOTA = 1000;

// Debug: confirm the key is loaded at startup
console.log('[email-validation] API_KEY loaded:', API_KEY ? `${API_KEY.slice(0, 8)}…` : 'MISSING');

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role  = (session?.user as any)?.role;
  const school = (session?.user as any)?.school;
  if (!session || !['Admin', 'Data Lead'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const client = await clientPromise;
  const db = client.db('student-label');
  const month = currentMonth();

  // Monthly usage
  const usageDoc = await db.collection('email_validation_usage').findOne({ month });
  const used = usageDoc?.count ?? 0;

  // Validation jobs (scoped to school for Data Leads)
  const jobQuery: Record<string, any> = {};
  if (role !== 'Admin') jobQuery.school = school;

  const page = parseInt(req.nextUrl.searchParams.get('page') ?? '1', 10);
  const limit = 50;
  const statusFilter = req.nextUrl.searchParams.get('status') ?? '';
  if (statusFilter) jobQuery.status = statusFilter;

  const total = await db.collection('email_validation_jobs').countDocuments(jobQuery);
  const jobs  = await db.collection('email_validation_jobs')
    .find(jobQuery)
    .sort({ submittedAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .toArray();

  return NextResponse.json({
    usage: { used, quota: MONTHLY_QUOTA, remaining: MONTHLY_QUOTA - used, month },
    jobs: jobs.map(j => ({ ...j, _id: j._id.toString() })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role   = (session?.user as any)?.role;
  const school = (session?.user as any)?.school;
  if (!session || !['Admin', 'Data Lead'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { studentIds } = await req.json() as { studentIds: string[] };
  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    return NextResponse.json({ error: 'studentIds array required' }, { status: 400 });
  }

  const client = await clientPromise;
  const db = client.db('student-label');
  const month = currentMonth();

  // ── Quota check ────────────────────────────────────────────────────────────
  const usageDoc = await db.collection('email_validation_usage').findOne({ month });
  const used = usageDoc?.count ?? 0;
  if (used + studentIds.length > MONTHLY_QUOTA) {
    return NextResponse.json({
      error: `Monthly quota would be exceeded. Used: ${used}/${MONTHLY_QUOTA}. Requested: ${studentIds.length}.`,
    }, { status: 429 });
  }

  // ── Fetch students ─────────────────────────────────────────────────────────
  const schoolFilter: Record<string, any> = role !== 'Admin' ? { school } : {};
  const oids = studentIds.map(id => new ObjectId(id));
  const students = await db.collection('students')
    .find({ _id: { $in: oids }, ...schoolFilter })
    .project({ firstName: 1, lastName: 1, email: 1, school: 1, labelId: 1, studentId: 1 })
    .toArray();

  if (students.length === 0) {
    return NextResponse.json({ error: 'No matching students found.' }, { status: 404 });
  }

  // ── Submit each email to emailawesome ─────────────────────────────────────
  const submitted: any[] = [];
  const skipped:   any[] = [];

  for (const student of students) {
    const email = student.email?.trim();
    if (!email || !email.includes('@')) {
      skipped.push({ studentId: student._id.toString(), reason: 'No valid email' });
      continue;
    }

    try {
      // API expects field name "email", not "email_address"
      const requestBody = { email };
      console.log(`[email-validation] POST ${API_BASE} body:`, requestBody);

      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
        },
        body: JSON.stringify(requestBody),
      });

      console.log(`[email-validation] response status: ${res.status} ${res.statusText}`);

      if (!res.ok) {
        const errText = await res.text();
        console.error('[email-validation] error body:', errText);
        skipped.push({ studentId: student._id.toString(), email, reason: `API error ${res.status}: ${errText}` });
        continue;
      }

      const apiResult = await res.json();
      console.log('[email-validation] success response:', JSON.stringify(apiResult));
      // API returns the newly created job object
      const job = {
        validationId:  apiResult.id ?? null,
        studentDbId:   student._id.toString(),
        email,
        firstName:     student.firstName,
        lastName:      student.lastName,
        school:        student.school ?? school,
        labelId:       student.labelId ?? student.studentId ?? '',
        status:        apiResult.status ?? 'IN_PROGRESS',
        emailStatus:   apiResult.email_address_status ?? 'UNKNOWN',
        submittedAt:   new Date().toISOString(),
        completedAt:   null,
        submittedBy:   { name: session.user?.name, email: session.user?.email },
      };
      await db.collection('email_validation_jobs').insertOne(job);
      submitted.push(job);
    } catch (err) {
      skipped.push({
        studentId: student._id.toString(),
        email,
        reason: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  // ── Increment monthly usage ────────────────────────────────────────────────
  if (submitted.length > 0) {
    await db.collection('email_validation_usage').updateOne(
      { month },
      { $inc: { count: submitted.length }, $setOnInsert: { month } },
      { upsert: true },
    );
  }

  return NextResponse.json({ submitted: submitted.length, skipped });
}
