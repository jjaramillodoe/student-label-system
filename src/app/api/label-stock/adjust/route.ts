import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrDataLead } from '@/lib/requireSession';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import {
  applyStockAdjustment,
  computeBurnForecast,
  enrichStockRow,
  normalizeSchoolKey,
  type AdjustAction,
  type LabelStockDoc,
} from '@/lib/labelStock';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdminOrDataLead();
    if (!auth.ok) return auth.response;
    const role = auth.user.role;
    const user = auth.user;
    const userSchool = normalizeSchoolKey(user.school);
    if (role === 'Data Lead' && !userSchool) {
      return NextResponse.json({ error: 'No school assigned' }, { status: 403 });
    }

    const body = await req.json();
    const stockId = String(body.stockId || '').trim();
    const action = String(body.action || '').trim() as AdjustAction;

    if (!stockId || !ObjectId.isValid(stockId)) {
      return NextResponse.json({ error: 'Valid stockId is required' }, { status: 400 });
    }
    if (!['restock', 'used', 'adjust', 'ordered'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('student-label');

    const existing = (await db.collection('label_stock').findOne({
      _id: new ObjectId(stockId),
    })) as LabelStockDoc | null;
    if (!existing) {
      return NextResponse.json({ error: 'Stock not found' }, { status: 404 });
    }

    if (
      role === 'Data Lead' &&
      normalizeSchoolKey(existing.school) &&
      normalizeSchoolKey(existing.school) !== userSchool
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const result = await applyStockAdjustment(db, {
      stockId: existing._id,
      action,
      quantity: body.quantity,
      units: body.units,
      packs: body.packs,
      note: body.note ? String(body.note) : undefined,
      reorderQty: body.reorderQty,
      user: {
        name: user.name,
        email: user.email,
        role: user.role,
        school: user.school,
      },
    });

    if (!result.ok || !result.stock) {
      return NextResponse.json({ error: result.error || 'Adjustment failed' }, { status: 400 });
    }

    const forecast = await computeBurnForecast(db, result.stock._id, 30);
    return NextResponse.json({
      stock: enrichStockRow(result.stock, forecast),
      delta: result.delta,
    });
  } catch (error) {
    console.error('[label-stock/adjust]', error);
    return NextResponse.json({ error: 'Failed to adjust stock' }, { status: 500 });
  }
}
