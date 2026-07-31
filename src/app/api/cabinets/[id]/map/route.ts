import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

/**
 * PATCH — update floor-map coordinates only.
 * Body: { mapRow: number | null, mapCol: number | null }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !['Admin', 'Data Lead'].includes(session.user?.role || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { mapRow, mapCol } = body;

    const normalize = (v: unknown): number | null => {
      if (v === null || v === undefined || v === '') return null;
      const n = typeof v === 'number' ? v : parseInt(String(v), 10);
      return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
    };

    const client = await clientPromise;
    const db = client.db('student-label');
    const cabinet = await db.collection('cabinets').findOne({ _id: new ObjectId(id) });
    if (!cabinet) {
      return NextResponse.json({ error: 'Cabinet not found' }, { status: 404 });
    }
    if (
      session.user.role !== 'Admin' &&
      session.user.school &&
      cabinet.school !== session.user.school
    ) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const nextRow = normalize(mapRow);
    const nextCol = normalize(mapCol);

    await db.collection('cabinets').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          mapRow: nextRow,
          mapCol: nextCol,
          updatedAt: new Date().toISOString(),
        },
      },
    );

    return NextResponse.json({
      _id: id,
      mapRow: nextRow,
      mapCol: nextCol,
    });
  } catch (error) {
    console.error('[cabinets/map]', error);
    return NextResponse.json({ error: 'Failed to update map position' }, { status: 500 });
  }
}
