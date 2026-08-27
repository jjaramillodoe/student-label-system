import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/requireSession';
import clientPromise from '@/lib/mongodb';
import { recordPrintHistoryAndConsume } from '@/lib/labelStock';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireSession();
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const userId = searchParams.get('userId');
    const studentId = searchParams.get('studentId');
    const limit = parseInt(searchParams.get('limit') || '100');
    const idsOnly = searchParams.get('idsOnly') === '1' || searchParams.get('idsOnly') === 'true';

    const client = await clientPromise;
    const db = client.db('student-label');

    const query: Record<string, unknown> = {};

    if (startDate || endDate) {
      query.time = {};
      if (startDate) (query.time as Record<string, unknown>).$gte = new Date(startDate);
      if (endDate) (query.time as Record<string, unknown>).$lte = new Date(endDate);
    }

    if (userId) {
      query['user.email'] = userId;
    }

    if (studentId) {
      query['students.studentId'] = studentId;
    }

    const userRole = auth.user?.role;
    const userSchool = auth.user?.school;
    if (userRole !== 'Admin' && userSchool) {
      query['user.school'] = userSchool;
    }

    // Distinct printed label/student IDs for "Needs label" filtering (full history).
    if (idsOnly) {
      const rows = await db.collection('print_history').aggregate([
        { $match: query },
        { $unwind: { path: '$students', preserveNullAndEmptyArrays: false } },
        {
          $group: {
            _id: null,
            studentIds: { $addToSet: '$students.studentId' },
            labelIds: { $addToSet: '$students.labelId' },
          },
        },
      ]).toArray();

      const row = rows[0] || {};
      const ids = [
        ...((row.studentIds as unknown[]) || []),
        ...((row.labelIds as unknown[]) || []),
      ]
        .map(v => (typeof v === 'string' ? v.trim() : ''))
        .filter(Boolean);

      return NextResponse.json({ ids: Array.from(new Set(ids)) });
    }

    const logs = await db
      .collection('print_history')
      .find(query)
      .sort({ time: -1 })
      .limit(limit)
      .toArray();

    return NextResponse.json(logs);
  } catch (error) {
    console.error('Error fetching print history:', error);
    return NextResponse.json({ error: 'Failed to fetch print history' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireSession();
    if (!auth.ok) return auth.response;

    const body = await req.json();
    const consumeStock = body.consumeStock === true;
    const students = Array.isArray(body.students) ? body.students : [];
    const labelCount = Number(body.labelCount) || students.length || 0;
    const layout = String(body.layout || '').trim();

    const client = await clientPromise;
    const db = client.db('student-label');

    const user = auth.user
      ? {
          name: auth.user.name,
          email: auth.user.email,
          role: auth.user?.role,
          school: auth.user?.school,
        }
      : null;

    if (consumeStock && layout && labelCount > 0) {
      const { printHistoryId, stock } = await recordPrintHistoryAndConsume(db, {
        user,
        students,
        labelCount,
        layout,
        status: body.status || 'completed',
        reprintOf: body.reprintOf,
        school: body.school,
        note: body.note,
        extra: {
          error: body.error,
          jobStatus: body.jobStatus,
        },
      });

      return NextResponse.json(
        {
          _id: printHistoryId,
          stockConsumed: stock.ok,
          stockUnitsConsumed: stock.units,
          stockSkipReason: stock.reason,
        },
        { status: 201 },
      );
    }

    // Preview / non-consuming log (legacy callers)
    const printLog = {
      ...body,
      stockConsumed: false,
      time: new Date().toISOString(),
      user,
    };

    const result = await db.collection('print_history').insertOne(printLog);
    return NextResponse.json({ _id: result.insertedId, ...printLog }, { status: 201 });
  } catch (error) {
    console.error('Error creating print history:', error);
    return NextResponse.json({ error: 'Failed to create print history' }, { status: 500 });
  }
}
