import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrDataLead } from '@/lib/requireSession';
import clientPromise from '@/lib/mongodb';
import { formatFullName } from '@/lib/personName';

function locLabel(loc?: {
  cabinetName?: string | null;
  drawerName?: string | null;
  drawerSection?: string | null;
} | null) {
  if (!loc) return '';
  return [loc.cabinetName, loc.drawerName, loc.drawerSection].filter(Boolean).join(' / ');
}

function csvEscape(value: unknown) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdminOrDataLead();
    if (!auth.ok) return auth.response;
    const role = auth.user.role;
    const userSchool = auth.user.school;

    const format = req.nextUrl.searchParams.get('format') || 'json';
    const limit = Math.min(
      format === 'csv' ? 1000 : 200,
      Math.max(1, parseInt(req.nextUrl.searchParams.get('limit') || (format === 'csv' ? '500' : '50'), 10)),
    );
    const client = await clientPromise;
    const db = client.db('student-label');

    const query: Record<string, unknown> = {};
    if (role === 'Data Lead' && userSchool) {
      query['user.school'] = userSchool;
    }

    const events = await db
      .collection('cabinet_move_events')
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    if (format === 'csv') {
      const header = [
        'when',
        'eventId',
        'source',
        'note',
        'movedBy',
        'studentId',
        'studentName',
        'from',
        'to',
      ];
      const lines = [header.join(',')];
      for (const ev of events) {
        const when = ev.createdAt || '';
        const eventId = String(ev._id);
        const source = ev.source || '';
        const note = ev.note || '';
        const movedBy =
          ev.user?.name || ev.user?.email || '';
        const students = Array.isArray(ev.students) ? ev.students : [];
        if (students.length === 0) {
          lines.push(
            [when, eventId, source, note, movedBy, '', '', '', '']
              .map(csvEscape)
              .join(','),
          );
          continue;
        }
        for (const s of students) {
          lines.push(
            [
              when,
              eventId,
              source,
              note,
              movedBy,
              s.studentId || '',
              formatFullName(s) || s.studentId || s._id || '',
              locLabel(s.from),
              locLabel(s.to),
            ]
              .map(csvEscape)
              .join(','),
          );
        }
      }
      return new NextResponse(lines.join('\n'), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="cabinet-move-history.csv"',
        },
      });
    }

    return NextResponse.json(
      events.map((e) => ({
        ...e,
        _id: String(e._id),
        students: (e.students || []).map(
          (s: {
            _id?: string;
            studentId?: string;
            firstName?: string;
            lastName?: string;
            from?: unknown;
            to?: unknown;
          }) => ({
            ...s,
            name: formatFullName(s) || s.studentId || s._id,
          }),
        ),
      })),
    );
  } catch (error) {
    console.error('[cabinets/move-history]', error);
    return NextResponse.json({ error: 'Failed to load move history' }, { status: 500 });
  }
}
