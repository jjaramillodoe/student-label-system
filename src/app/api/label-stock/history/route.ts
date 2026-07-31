import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { ObjectId } from 'mongodb';
import { getTemplateMeta, normalizeSchoolKey } from '@/lib/labelStockMeta';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as { role?: string })?.role;
    const userSchool = normalizeSchoolKey((session?.user as { school?: string })?.school);

    if (!session || !['Admin', 'Data Lead'].includes(role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (role === 'Data Lead' && !userSchool) {
      return NextResponse.json({ error: 'No school assigned' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const stockId = searchParams.get('stockId');
    const schoolParam = normalizeSchoolKey(searchParams.get('school'));
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') || '100', 10)));

    const query: Record<string, unknown> = {};
    if (stockId) {
      if (!ObjectId.isValid(stockId)) {
        return NextResponse.json({ error: 'Invalid stockId' }, { status: 400 });
      }
      query.stockId = new ObjectId(stockId);
    }

    if (role === 'Data Lead') {
      query.$or = [
        { school: userSchool },
        { school: { $exists: false } },
        { school: null },
        { school: '' },
      ];
    } else if (schoolParam) {
      query.school = schoolParam;
    }

    const client = await clientPromise;
    const db = client.db('student-label');
    const events = await db
      .collection('label_stock_events')
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    return NextResponse.json(
      events.map((e) => ({
        ...e,
        _id: String(e._id),
        stockId: e.stockId ? String(e.stockId) : null,
        printHistoryId: e.printHistoryId ? String(e.printHistoryId) : null,
        templateName: getTemplateMeta(String(e.template || '')).name,
      })),
    );
  } catch (error) {
    console.error('[label-stock/history]', error);
    return NextResponse.json({ error: 'Failed to fetch stock history' }, { status: 500 });
  }
}
