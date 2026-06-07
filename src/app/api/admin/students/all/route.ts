/**
 * GET /api/admin/students/all
 *
 * Returns paginated student records for the All Students page.
 * Supports search, email-status filter, school filter (Admin only), and CSV export.
 * Cabinet and drawer values are resolved to human-readable names.
 *
 * Query params:
 *   page          number   (default 1)
 *   limit         number   (default 50, max 500)
 *   search        string   name / labelId / studentId / email
 *   school        string   Admin only — filter by school
 *   emailStatus    string   VALID | INVALID | CATCH_ALL | UNKNOWN | none | unvalidated | any
 *   addressStatus  string   empty | unverified | verified | warning | not_found | needs_review | any
 *   format         csv      returns CSV text instead of JSON
 */

import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { ObjectId } from 'mongodb';

// ─── Cabinet / Drawer resolution ─────────────────────────────────────────────

/** Build an in-memory lookup map from all cabinets in the DB.
 *  Returns: Map<cabinetIdOrName → { cabinetName, drawers: [{id, name}] }>
 */
async function buildCabinetMap(db: any) {
  const cabinets = await db.collection('cabinets').find({}).toArray();
  const map = new Map<string, { name: string; drawers: { id: string; name: string }[] }>();

  for (const c of cabinets) {
    const id   = c._id.toString();
    const name = c.name || c.label || id;
    const drawers = (c.drawers || []).map((d: any) => ({
      id:   String(d._id ?? d.id ?? ''),
      name: d.name || String(d._id ?? d.id ?? ''),
    }));
    // Index by ObjectId string and by name
    map.set(id,   { name, drawers });
    if (c.name)  map.set(c.name,  { name, drawers });
    if (c.label) map.set(c.label, { name, drawers });
  }
  return map;
}

function resolveCabinetAndDrawer(
  cabinetRaw: string | undefined,
  drawerRaw:  string | undefined,
  cabinetMap: Map<string, { name: string; drawers: { id: string; name: string }[] }>,
): { cabinetName: string; drawerName: string } {
  if (!cabinetRaw) return { cabinetName: '', drawerName: '' };

  const cabinetKey = String(cabinetRaw);
  const entry = cabinetMap.get(cabinetKey);
  if (!entry) return { cabinetName: cabinetRaw, drawerName: drawerRaw ?? '' };

  const cabinetName = entry.name;
  let drawerName = drawerRaw ?? '';

  if (drawerRaw) {
    const drawerKey = String(drawerRaw);
    const match = entry.drawers.find(
      d => String(d.id) === drawerKey || d.name === drawerKey,
    );
    if (match) drawerName = match.name;
  }

  return { cabinetName, drawerName };
}

// ─── CSV helpers ─────────────────────────────────────────────────────────────

function escapeCSV(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCSV(rows: any[]): string {
  const headers = [
    'Label ID', 'Student ID', 'First Name', 'Last Name', 'DOB',
    'School', 'Cabinet', 'Drawer',
    'Address', 'Apt', 'City', 'State', 'ZIP', 'Address Status', 'Address Verified At',
    'Email', 'Email Status', 'Email Validated At',
    'Sibling Confirmed', 'Created At', 'Created By',
  ];
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push([
      escapeCSV(r.labelId ?? r.studentId),
      escapeCSV(r.studentId),
      escapeCSV(r.firstName),
      escapeCSV(r.lastName),
      escapeCSV(r.dob),
      escapeCSV(r.school),
      escapeCSV(r.cabinetName || r.cabinet),
      escapeCSV(r.drawerName  || r.drawer),
      escapeCSV(r.address),
      escapeCSV(r.apt),
      escapeCSV(r.city),
      escapeCSV(r.state),
      escapeCSV(r.zip),
      escapeCSV(r.addressValidationStatus ?? ''),
      escapeCSV(r.addressVerifiedAt ?? ''),
      escapeCSV(r.email),
      escapeCSV(r.emailValidationStatus ?? ''),
      escapeCSV(r.emailValidatedAt ?? ''),
      escapeCSV(r.siblingConfirmed ? 'Yes' : ''),
      escapeCSV(r.createdAt ?? ''),
      escapeCSV(r.createdBy?.name ?? r.createdBy ?? ''),
    ].join(','));
  }
  return lines.join('\n');
}

// ─── Route ───────────────────────────────────────────────────────────────────

function enrichWithNames(
  students: any[],
  cabinetMap: Map<string, { name: string; drawers: { id: string; name: string }[] }>,
) {
  return students.map(s => {
    const { cabinetName, drawerName } = resolveCabinetAndDrawer(s.cabinet, s.drawer, cabinetMap);
    return { ...s, _id: s._id.toString(), cabinetName, drawerName };
  });
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  const userSchool = (session?.user as any)?.school;
  if (!session || !['Admin', 'Data Lead', 'Data Member'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const page        = Math.max(1, parseInt(searchParams.get('page')  ?? '1'));
  const rawLimit    = parseInt(searchParams.get('limit') ?? '50');
  const limit       = Math.min(Math.max(1, rawLimit), 500);
  const search      = searchParams.get('search')?.trim() ?? '';
  const schoolParam = searchParams.get('school')?.trim() ?? '';
  const emailStatus   = searchParams.get('emailStatus')?.trim() ?? '';
  const addressStatus = searchParams.get('addressStatus')?.trim() ?? '';
  const format        = searchParams.get('format') ?? '';

  const client = await clientPromise;
  const db = client.db('student-label');

  // Build filter
  const filter: Record<string, any> = {};

  if (role !== 'Admin') {
    filter.school = userSchool;
  } else if (schoolParam) {
    filter.school = schoolParam;
  }

  if (emailStatus === 'none') {
    filter.email = { $in: [null, ''] };
  } else if (emailStatus === 'unvalidated') {
    filter.email = { $exists: true, $ne: '' };
    filter.emailValidationStatus = { $in: [null, '', undefined] };
  } else if (['VALID', 'INVALID', 'CATCH_ALL', 'UNKNOWN'].includes(emailStatus)) {
    filter.emailValidationStatus = emailStatus;
  }

  if (addressStatus === 'empty') {
    filter.$and = [
      ...(Array.isArray(filter.$and) ? filter.$and : []),
      {
        $or: [
          { address: { $in: [null, ''] } },
          { address: { $exists: false } },
        ],
      },
    ];
  } else if (addressStatus === 'unverified') {
    filter.address = { $exists: true, $nin: [null, ''] };
    filter.$and = [
      ...(Array.isArray(filter.$and) ? filter.$and : []),
      {
        $or: [
          { addressValidationStatus: { $in: [null, '', 'unverified'] } },
          { addressValidationStatus: { $exists: false } },
        ],
      },
    ];
  } else if (['verified', 'warning', 'not_found', 'error'].includes(addressStatus)) {
    filter.addressValidationStatus = addressStatus;
  } else if (addressStatus === 'needs_review') {
    filter.addressValidationStatus = { $in: ['warning', 'not_found', 'error'] };
  }

  if (search) {
    const re = { $regex: search, $options: 'i' };
    filter.$or = [
      { firstName: re }, { lastName: re },
      { email: re },
      { labelId: re }, { studentId: re },
    ];
  }

  const [total, cabinetMap] = await Promise.all([
    db.collection('students').countDocuments(filter),
    buildCabinetMap(db),
  ]);

  // CSV export — no pagination, all matching rows
  if (format === 'csv') {
    const rows = await db.collection('students')
      .find(filter)
      .sort({ lastName: 1, firstName: 1 })
      .toArray();

    const enriched = enrichWithNames(rows, cabinetMap);
    const csv = toCSV(enriched);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="students-export-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  const rawStudents = await db.collection('students')
    .find(filter)
    .sort({ lastName: 1, firstName: 1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .toArray();

  const students = enrichWithNames(rawStudents, cabinetMap);

  const schools: string[] = role === 'Admin'
    ? await db.collection('students').distinct('school')
    : [];

  return NextResponse.json({
    students,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    schools: schools.filter(Boolean).sort(),
  });
}
