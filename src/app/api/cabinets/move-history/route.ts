import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import clientPromise from '@/lib/mongodb';
import { formatFullName } from '@/lib/personName';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;
    const userSchool = session?.user?.school;

    if (!session || !['Admin', 'Data Lead'].includes(role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const limit = Math.min(200, Math.max(1, parseInt(req.nextUrl.searchParams.get('limit') || '50', 10)));
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
