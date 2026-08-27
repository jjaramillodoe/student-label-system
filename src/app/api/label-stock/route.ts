import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrDataLead } from '@/lib/requireSession';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import {
  computeBurnForecast,
  ensureLabelStockIndexes,
  enrichStockRow,
  getTemplateMeta,
  normalizeSchoolKey,
  type LabelStockDoc,
} from '@/lib/labelStock';
import { maybeNotifyLowStock } from '@/lib/notifications';

async function requireStockAdmin() {
  const auth = await requireAdminOrDataLead();
  if (!auth.ok) return { error: auth.response };
  const school = normalizeSchoolKey(auth.user.school);
  if (auth.user.role === 'Data Lead' && !school) {
    return {
      error: NextResponse.json({ error: 'No school assigned' }, { status: 403 }),
    };
  }
  return { role: auth.user.role, school, user: auth.user };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireStockAdmin();
    if ('error' in auth && auth.error) return auth.error;

    const { searchParams } = new URL(req.url);
    const schoolParam = normalizeSchoolKey(searchParams.get('school'));
    const withForecast = searchParams.get('forecast') !== '0';

    const client = await clientPromise;
    const db = client.db('student-label');
    await ensureLabelStockIndexes(db);

    const query: Record<string, unknown> = {};
    if (auth.role === 'Data Lead') {
      query.$or = [
        { school: auth.school },
        { school: { $exists: false } },
        { school: null },
        { school: '' },
      ];
    } else if (schoolParam) {
      query.school = schoolParam;
    }

    const stock = (await db
      .collection('label_stock')
      .find(query)
      .sort({ school: 1, template: 1 })
      .toArray()) as LabelStockDoc[];

    const rows = await Promise.all(
      stock.map(async (item) => {
        const forecast = withForecast
          ? await computeBurnForecast(db, item._id, 30)
          : undefined;
        return enrichStockRow(item, forecast);
      }),
    );

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error fetching label stock:', error);
    return NextResponse.json({ error: 'Failed to fetch label stock' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireStockAdmin();
    if ('error' in auth && auth.error) return auth.error;

    const body = await req.json();
    const template = String(body.template || '').trim();
    if (!template) {
      return NextResponse.json({ error: 'Template is required' }, { status: 400 });
    }

    const meta = getTemplateMeta(template);
    let school = normalizeSchoolKey(body.school);
    if (auth.role === 'Data Lead') {
      school = auth.school!;
    }
    if (!school) {
      return NextResponse.json({ error: 'School is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('student-label');
    await ensureLabelStockIndexes(db);

    const existing = await db.collection('label_stock').findOne({ template, school });
    if (existing) {
      return NextResponse.json(
        { error: `Stock entry for ${meta.name} already exists for ${school}` },
        { status: 409 },
      );
    }

    const now = new Date().toISOString();
    const packSize = Math.max(
      1,
      Math.floor(Number(body.packSize) || meta.defaultPackSize),
    );
    const stockData = {
      template,
      school,
      currentStock: Math.max(0, Math.floor(Number(body.currentStock) || 0)),
      unit: meta.unit,
      packSize,
      lowStockThreshold: Math.max(0, Math.floor(Number(body.lowStockThreshold) || 100)),
      costPerSheet: Math.max(0, Number(body.costPerSheet) || 0),
      supplier: String(body.supplier || '').trim(),
      supplierUrl: String(body.supplierUrl || '').trim(),
      sku: String(body.sku || '').trim(),
      reorderQty: Math.max(0, Math.floor(Number(body.reorderQty) || packSize)),
      lastOrderedAt: body.lastOrderedAt || null,
      notes: String(body.notes || '').trim(),
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection('label_stock').insertOne(stockData);
    await db.collection('label_stock_events').insertOne({
      stockId: result.insertedId,
      school,
      template,
      type: 'create',
      delta: stockData.currentStock,
      quantityBefore: 0,
      quantityAfter: stockData.currentStock,
      note: 'Stock entry created',
      user: {
        name: auth.user?.name || null,
        email: auth.user?.email || null,
        role: auth.user?.role || null,
        school: auth.user?.school || null,
      },
      createdAt: now,
    });

    return NextResponse.json(
      enrichStockRow({ _id: result.insertedId, ...stockData } as LabelStockDoc),
      { status: 201 },
    );
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: number }).code === 11000
    ) {
      return NextResponse.json(
        { error: 'A stock entry for this template and school already exists' },
        { status: 409 },
      );
    }
    console.error('Error creating label stock:', error);
    return NextResponse.json({ error: 'Failed to create label stock' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireStockAdmin();
    if ('error' in auth && auth.error) return auth.error;

    const body = await req.json();
    const { _id, ...raw } = body;

    if (!_id) {
      return NextResponse.json({ error: 'Stock ID required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('student-label');
    await ensureLabelStockIndexes(db);

    const existing = (await db.collection('label_stock').findOne({
      _id: new ObjectId(_id),
    })) as LabelStockDoc | null;
    if (!existing) {
      return NextResponse.json({ error: 'Stock not found' }, { status: 404 });
    }

    if (
      auth.role === 'Data Lead' &&
      normalizeSchoolKey(existing.school) &&
      normalizeSchoolKey(existing.school) !== auth.school
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const meta = getTemplateMeta(String(raw.template || existing.template));
    let school = normalizeSchoolKey(raw.school ?? existing.school);
    if (auth.role === 'Data Lead') school = auth.school!;
    if (!school) {
      return NextResponse.json({ error: 'School is required' }, { status: 400 });
    }

    const template = String(raw.template || existing.template).trim();
    const duplicate = await db.collection('label_stock').findOne({
      template,
      school,
      _id: { $ne: existing._id },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: `Stock entry for ${meta.name} already exists for ${school}` },
        { status: 409 },
      );
    }

    const before = Number(existing.currentStock) || 0;
    const updateData = {
      template,
      school,
      currentStock: Math.max(0, Math.floor(Number(raw.currentStock ?? existing.currentStock) || 0)),
      unit: meta.unit,
      packSize: Math.max(1, Math.floor(Number(raw.packSize ?? existing.packSize) || meta.defaultPackSize)),
      lowStockThreshold: Math.max(
        0,
        Math.floor(Number(raw.lowStockThreshold ?? existing.lowStockThreshold) || 100),
      ),
      costPerSheet: Math.max(0, Number(raw.costPerSheet ?? existing.costPerSheet) || 0),
      supplier: String(raw.supplier ?? existing.supplier ?? '').trim(),
      supplierUrl: String(raw.supplierUrl ?? existing.supplierUrl ?? '').trim(),
      sku: String(raw.sku ?? existing.sku ?? '').trim(),
      reorderQty: Math.max(
        0,
        Math.floor(Number(raw.reorderQty ?? existing.reorderQty) || 0),
      ),
      lastOrderedAt: raw.lastOrderedAt !== undefined ? raw.lastOrderedAt : existing.lastOrderedAt,
      notes: String(raw.notes ?? existing.notes ?? '').trim(),
      updatedAt: new Date().toISOString(),
    };

    const result = (await db.collection('label_stock').findOneAndUpdate(
      { _id: existing._id },
      { $set: updateData },
      { returnDocument: 'after' },
    )) as LabelStockDoc | null;

    if (!result) {
      return NextResponse.json({ error: 'Stock not found' }, { status: 404 });
    }

    const after = Number(result.currentStock) || 0;
    if (after !== before) {
      await db.collection('label_stock_events').insertOne({
        stockId: existing._id,
        school,
        template,
        type: 'adjust',
        delta: after - before,
        quantityBefore: before,
        quantityAfter: after,
        note: 'Edited via stock form',
        user: {
          name: auth.user?.name || null,
          email: auth.user?.email || null,
          role: auth.user?.role || null,
          school: auth.user?.school || null,
        },
        createdAt: new Date().toISOString(),
      });
    }

    void maybeNotifyLowStock(db, {
      template: result.template,
      currentStock: result.currentStock,
      lowStockThreshold: result.lowStockThreshold,
    }).catch((err) => console.error('[label-stock] notify failed', err));

    const forecast = await computeBurnForecast(db, result._id, 30);
    return NextResponse.json(enrichStockRow(result, forecast));
  } catch (error) {
    console.error('Error updating label stock:', error);
    return NextResponse.json({ error: 'Failed to update label stock' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireStockAdmin();
    if ('error' in auth && auth.error) return auth.error;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Stock ID required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('student-label');

    const existing = (await db.collection('label_stock').findOne({
      _id: new ObjectId(id),
    })) as LabelStockDoc | null;
    if (!existing) {
      return NextResponse.json({ error: 'Stock not found' }, { status: 404 });
    }

    if (
      auth.role === 'Data Lead' &&
      normalizeSchoolKey(existing.school) &&
      normalizeSchoolKey(existing.school) !== auth.school
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await db.collection('label_stock').deleteOne({ _id: existing._id });
    await db.collection('label_stock_events').insertOne({
      stockId: existing._id,
      school: normalizeSchoolKey(existing.school),
      template: existing.template,
      type: 'delete',
      delta: -(Number(existing.currentStock) || 0),
      quantityBefore: Number(existing.currentStock) || 0,
      quantityAfter: 0,
      note: 'Stock entry deleted',
      user: {
        name: auth.user?.name || null,
        email: auth.user?.email || null,
        role: auth.user?.role || null,
        school: auth.user?.school || null,
      },
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting label stock:', error);
    return NextResponse.json({ error: 'Failed to delete label stock' }, { status: 500 });
  }
}
