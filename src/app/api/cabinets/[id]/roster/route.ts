import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrDataLead } from '@/lib/requireSession';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { formatFullName } from '@/lib/personName';
import { formatDrawerSectionLabel } from '@/lib/drawerSections';

function csvEscape(value: unknown): string {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAdminOrDataLead();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid cabinet id' }, { status: 400 });
    }

    const drawerId = req.nextUrl.searchParams.get('drawerId') || '';
    const section = req.nextUrl.searchParams.get('section') || ''; // "Section 01" or "01"
    const format = req.nextUrl.searchParams.get('format') || 'json';

    const client = await clientPromise;
    const db = client.db('student-label');
    const cabinet = await db.collection('cabinets').findOne({ _id: new ObjectId(id) });
    if (!cabinet) {
      return NextResponse.json({ error: 'Cabinet not found' }, { status: 404 });
    }

    const userRole = auth.user.role;
    const userSchool = auth.user.school;
    if (userRole !== 'Admin' && userSchool && cabinet.school !== userSchool) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const query: Record<string, unknown> = {
      cabinet: id,
      $or: [{ archived: { $ne: true } }, { archived: { $exists: false } }],
    };
    if (drawerId) query.drawer = drawerId;

    if (section) {
      const normalized = section.match(/\d+/)
        ? formatDrawerSectionLabel(parseInt(section.match(/\d+/)![0], 10))
        : section;
      query.drawerSection = normalized;
    }

    const students = await db
      .collection('students')
      .find(query)
      .project({
        firstName: 1,
        lastName: 1,
        studentId: 1,
        labelId: 1,
        dob: 1,
        status: 1,
        fiscalYear: 1,
        email: 1,
        drawer: 1,
        drawerSection: 1,
        startDate: 1,
        createdAt: 1,
      })
      .sort({ lastName: 1, firstName: 1 })
      .toArray();

    const drawerMap = new Map(
      (cabinet.drawers || []).map((d: { _id?: string; name?: string }) => [
        String(d._id),
        d.name || '',
      ]),
    );

    const rows = students.map((s, index) => ({
      index: index + 1,
      _id: String(s._id),
      name: formatFullName(s),
      firstName: s.firstName || '',
      lastName: s.lastName || '',
      labelId: s.labelId || '',
      studentId: s.studentId || '',
      dob: s.dob || '',
      status: s.status || '',
      fiscalYear: s.fiscalYear || '',
      email: s.email || '',
      drawerId: s.drawer || '',
      drawerName: drawerMap.get(String(s.drawer || '')) || '',
      drawerSection: s.drawerSection || '',
      startDate: s.startDate || '',
    }));

    const meta = {
      cabinetId: id,
      cabinetName: cabinet.identifier
        ? `${cabinet.name} (${cabinet.identifier})`
        : cabinet.name,
      school: cabinet.school || '',
      drawerId: drawerId || null,
      drawerName: drawerId ? drawerMap.get(drawerId) || null : null,
      section: section
        ? section.match(/\d+/)
          ? formatDrawerSectionLabel(parseInt(section.match(/\d+/)![0], 10))
          : section
        : null,
      count: rows.length,
    };

    if (format === 'csv') {
      const headers = [
        '#',
        'Name',
        'Label ID',
        'Student ID',
        'DOB',
        'Status',
        'FY',
        'Drawer',
        'Section',
        'Email',
      ];
      const lines = [
        `# ${meta.cabinetName}${meta.drawerName ? ` · ${meta.drawerName}` : ''}${meta.section ? ` · ${meta.section}` : ''}`,
        `# School: ${meta.school || '—'} · ${meta.count} student(s)`,
        headers.join(','),
        ...rows.map((r) =>
          [
            r.index,
            r.name,
            r.labelId,
            r.studentId,
            r.dob,
            r.status,
            r.fiscalYear,
            r.drawerName,
            r.drawerSection,
            r.email,
          ]
            .map(csvEscape)
            .join(','),
        ),
      ];
      const slug = [
        meta.cabinetName,
        meta.drawerName,
        meta.section,
      ]
        .filter(Boolean)
        .join('-')
        .replace(/[^\w.-]+/g, '_');
      return new NextResponse(lines.join('\n'), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="roster-${slug || id}.csv"`,
        },
      });
    }

    return NextResponse.json({ ...meta, students: rows });
  } catch (error) {
    console.error('[cabinets/roster]', error);
    return NextResponse.json({ error: 'Failed to load roster' }, { status: 500 });
  }
}
