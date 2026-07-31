/**
 * Label stock inventory: units, consumption, adjustments, and burn forecast.
 * Server-only — do not import from Client Components (pulls Mongo/email).
 * Client-safe template helpers live in `@/lib/labelStockMeta`.
 */

import type { Db, ObjectId } from 'mongodb';
import {
  getTemplateMeta,
  normalizeSchoolKey,
  unitsForLabelCount,
  type StockUnit,
} from '@/lib/labelStockMeta';

export {
  LABEL_STOCK_TEMPLATES,
  getTemplateMeta,
  normalizeSchoolKey,
  unitsForLabelCount,
  type LabelStockTemplateMeta,
  type StockUnit,
} from '@/lib/labelStockMeta';

export type StockActor = {
  name?: string | null;
  email?: string | null;
  role?: string | null;
  school?: string | null;
};

export type LabelStockDoc = {
  _id: ObjectId;
  template: string;
  school: string;
  currentStock: number;
  unit: StockUnit;
  packSize: number;
  lowStockThreshold: number;
  /** Cost per sheet (Avery) or per label (Brother). Legacy field name kept. */
  costPerSheet: number;
  supplier?: string;
  supplierUrl?: string;
  sku?: string;
  reorderQty?: number;
  lastOrderedAt?: string | null;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type StockEventType =
  | 'print'
  | 'restock'
  | 'used'
  | 'adjust'
  | 'ordered'
  | 'create'
  | 'delete';

let indexesEnsured = false;

async function notifyLowStockSafe(
  db: Db,
  stock: { template?: string; currentStock?: number; lowStockThreshold?: number },
) {
  try {
    const { maybeNotifyLowStock } = await import('@/lib/notifications');
    await maybeNotifyLowStock(db, stock);
  } catch (err) {
    console.error('[labelStock] notify failed', err);
  }
}

export async function ensureLabelStockIndexes(db: Db): Promise<void> {
  if (indexesEnsured) return;
  try {
    await db.collection('label_stock').createIndex(
      { template: 1, school: 1 },
      { unique: true, name: 'template_school_unique' },
    );
    await db.collection('label_stock_events').createIndex(
      { stockId: 1, createdAt: -1 },
      { name: 'stockId_createdAt' },
    );
    await db.collection('label_stock_events').createIndex(
      { school: 1, createdAt: -1 },
      { name: 'school_createdAt' },
    );
    indexesEnsured = true;
  } catch (err) {
    // Index may already exist with different options; don't block requests.
    console.warn('[labelStock] index ensure failed', err);
    indexesEnsured = true;
  }
}

export async function findStockEntry(
  db: Db,
  template: string,
  school: string,
): Promise<LabelStockDoc | null> {
  const schoolKey = normalizeSchoolKey(school);
  if (schoolKey) {
    const scoped = await db.collection('label_stock').findOne({ template, school: schoolKey });
    if (scoped) return scoped as LabelStockDoc;
  }

  // Legacy unscoped rows (pre school-scoped stock)
  const legacy = await db.collection('label_stock').findOne({
    template,
    $or: [
      { school: { $exists: false } },
      { school: null },
      { school: '' },
    ],
  });
  return (legacy as LabelStockDoc) || null;
}

function actorPayload(user?: StockActor | null) {
  return user
    ? {
        name: user.name || null,
        email: user.email || null,
        role: user.role || null,
        school: user.school || null,
      }
    : null;
}

async function insertEvent(
  db: Db,
  event: {
    stockId: ObjectId;
    school: string;
    template: string;
    type: StockEventType;
    delta: number;
    quantityBefore: number;
    quantityAfter: number;
    labelCount?: number;
    unitsConsumed?: number;
    packs?: number;
    packSize?: number;
    printHistoryId?: string | ObjectId | null;
    note?: string;
    user?: StockActor | null;
  },
) {
  await db.collection('label_stock_events').insertOne({
    ...event,
    user: actorPayload(event.user),
    createdAt: new Date().toISOString(),
  });
}

export async function consumeLabelStockForPrint(
  db: Db,
  params: {
    template: string;
    school: string;
    labelCount: number;
    user?: StockActor | null;
    printHistoryId?: string | ObjectId | null;
    note?: string;
  },
): Promise<{
  ok: boolean;
  reason?: string;
  units?: number;
  before?: number;
  after?: number;
  stockId?: ObjectId;
}> {
  await ensureLabelStockIndexes(db);

  const template = String(params.template || '').trim();
  if (!template) return { ok: false, reason: 'missing_template' };

  const units = unitsForLabelCount(template, params.labelCount);
  if (units <= 0) return { ok: false, reason: 'zero_units' };

  const school = normalizeSchoolKey(params.school) || normalizeSchoolKey(params.user?.school);
  const stock = await findStockEntry(db, template, school);
  if (!stock) {
    return { ok: false, reason: 'no_stock_entry' };
  }

  const before = Number(stock.currentStock) || 0;
  const after = Math.max(0, before - units);
  const now = new Date().toISOString();

  await db.collection('label_stock').updateOne(
    { _id: stock._id },
    { $set: { currentStock: after, updatedAt: now } },
  );

  await insertEvent(db, {
    stockId: stock._id,
    school: normalizeSchoolKey(stock.school) || school,
    template,
    type: 'print',
    delta: after - before,
    quantityBefore: before,
    quantityAfter: after,
    labelCount: Math.max(0, Math.floor(Number(params.labelCount) || 0)),
    unitsConsumed: units,
    printHistoryId: params.printHistoryId || null,
    note: params.note,
    user: params.user,
  });

  void notifyLowStockSafe(db, {
    template,
    currentStock: after,
    lowStockThreshold: stock.lowStockThreshold,
  });

  return { ok: true, units, before, after, stockId: stock._id };
}

export type AdjustAction = 'restock' | 'used' | 'adjust' | 'ordered';

export async function applyStockAdjustment(
  db: Db,
  params: {
    stockId: ObjectId;
    action: AdjustAction;
    /** Absolute stock level when action === 'adjust'. */
    quantity?: number;
    /** Units to add (restock) or subtract (used). */
    units?: number;
    /** Packs to add on restock (units = packs * packSize). */
    packs?: number;
    note?: string;
    user?: StockActor | null;
    reorderQty?: number;
  },
): Promise<{ ok: boolean; error?: string; stock?: LabelStockDoc; delta?: number }> {
  await ensureLabelStockIndexes(db);

  const stock = (await db.collection('label_stock').findOne({
    _id: params.stockId,
  })) as LabelStockDoc | null;
  if (!stock) return { ok: false, error: 'Stock not found' };

  const before = Number(stock.currentStock) || 0;
  const packSize = Math.max(1, Number(stock.packSize) || getTemplateMeta(stock.template).defaultPackSize);
  const now = new Date().toISOString();
  let after = before;
  let delta = 0;
  let packs: number | undefined;
  const setFields: Record<string, unknown> = { updatedAt: now };

  if (params.action === 'ordered') {
    setFields.lastOrderedAt = now;
    if (params.reorderQty != null && Number.isFinite(Number(params.reorderQty))) {
      setFields.reorderQty = Math.max(0, Math.floor(Number(params.reorderQty)));
    }
    after = before;
    delta = 0;
  } else if (params.action === 'restock') {
    if (params.packs != null && Number(params.packs) > 0) {
      packs = Math.floor(Number(params.packs));
      delta = packs * packSize;
    } else {
      delta = Math.max(0, Math.floor(Number(params.units) || 0));
    }
    if (delta <= 0) return { ok: false, error: 'Restock quantity must be positive' };
    after = before + delta;
    setFields.currentStock = after;
  } else if (params.action === 'used') {
    delta = -Math.max(0, Math.floor(Number(params.units) || 0));
    if (delta === 0) return { ok: false, error: 'Used quantity must be positive' };
    after = Math.max(0, before + delta);
    setFields.currentStock = after;
  } else if (params.action === 'adjust') {
    if (params.quantity == null || !Number.isFinite(Number(params.quantity))) {
      return { ok: false, error: 'Adjust requires a quantity' };
    }
    after = Math.max(0, Math.floor(Number(params.quantity)));
    delta = after - before;
    setFields.currentStock = after;
  } else {
    return { ok: false, error: 'Unknown action' };
  }

  const updated = (await db.collection('label_stock').findOneAndUpdate(
    { _id: stock._id },
    { $set: setFields },
    { returnDocument: 'after' },
  )) as LabelStockDoc | null;

  await insertEvent(db, {
    stockId: stock._id,
    school: normalizeSchoolKey(stock.school),
    template: stock.template,
    type: params.action,
    delta,
    quantityBefore: before,
    quantityAfter: after,
    packs,
    packSize,
    note: params.note,
    user: params.user,
  });

  if (params.action !== 'ordered' && updated) {
    void notifyLowStockSafe(db, {
      template: updated.template,
      currentStock: updated.currentStock,
      lowStockThreshold: updated.lowStockThreshold,
    });
  }

  return { ok: true, stock: updated || undefined, delta };
}

export async function computeBurnForecast(
  db: Db,
  stockId: ObjectId,
  windowDays = 30,
): Promise<{
  windowDays: number;
  unitsBurned: number;
  avgPerDay: number;
  daysLeft: number | null;
  currentStock: number;
}> {
  const stock = (await db.collection('label_stock').findOne({
    _id: stockId,
  })) as LabelStockDoc | null;
  const currentStock = Number(stock?.currentStock) || 0;
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

  const events = await db
    .collection('label_stock_events')
    .find({
      stockId,
      createdAt: { $gte: since },
      type: { $in: ['print', 'used'] },
    })
    .project({ delta: 1 })
    .toArray();

  const unitsBurned = events.reduce((sum, e) => {
    const d = Number(e.delta) || 0;
    return sum + (d < 0 ? -d : 0);
  }, 0);

  const avgPerDay = unitsBurned / windowDays;
  const daysLeft =
    avgPerDay > 0 ? Math.floor(currentStock / avgPerDay) : currentStock > 0 ? null : 0;

  return { windowDays, unitsBurned, avgPerDay, daysLeft, currentStock };
}

export function resolvePrintSchool(params: {
  sessionSchool?: string | null;
  students?: Array<{ school?: string | null }>;
  explicitSchool?: string | null;
}): string {
  const explicit = normalizeSchoolKey(params.explicitSchool);
  if (explicit) return explicit;

  const sessionSchool = normalizeSchoolKey(params.sessionSchool);
  if (sessionSchool) return sessionSchool;

  const fromStudents = (params.students || [])
    .map((s) => normalizeSchoolKey(s.school))
    .filter(Boolean);
  if (fromStudents.length === 0) return '';

  const counts = new Map<string, number>();
  for (const s of fromStudents) counts.set(s, (counts.get(s) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

export async function recordPrintHistoryAndConsume(
  db: Db,
  params: {
    user: StockActor | null;
    students: unknown[];
    labelCount: number;
    layout: string;
    status?: string;
    reprintOf?: string;
    school?: string;
    note?: string;
    extra?: Record<string, unknown>;
  },
): Promise<{ printHistoryId: ObjectId; stock: Awaited<ReturnType<typeof consumeLabelStockForPrint>> }> {
  const school = resolvePrintSchool({
    sessionSchool: params.user?.school,
    students: params.students as Array<{ school?: string | null }>,
    explicitSchool: params.school,
  });

  const printLog = {
    students: params.students,
    labelCount: params.labelCount,
    layout: params.layout,
    status: params.status || 'completed',
    reprintOf: params.reprintOf,
    school,
    stockConsumed: true,
    ...(params.extra || {}),
    time: new Date().toISOString(),
    user: actorPayload(params.user),
  };

  const result = await db.collection('print_history').insertOne(printLog);
  const stock = await consumeLabelStockForPrint(db, {
    template: params.layout,
    school,
    labelCount: params.labelCount,
    user: params.user,
    printHistoryId: result.insertedId,
    note: params.note,
  });

  if (stock.ok) {
    await db.collection('print_history').updateOne(
      { _id: result.insertedId },
      {
        $set: {
          stockUnitsConsumed: stock.units,
          stockBefore: stock.before,
          stockAfter: stock.after,
        },
      },
    );
  } else {
    await db.collection('print_history').updateOne(
      { _id: result.insertedId },
      { $set: { stockConsumed: false, stockSkipReason: stock.reason } },
    );
  }

  return { printHistoryId: result.insertedId, stock };
}

export function enrichStockRow(
  item: LabelStockDoc & { _id: ObjectId | string },
  forecast?: { daysLeft: number | null; avgPerDay: number; unitsBurned: number; windowDays: number },
) {
  const meta = getTemplateMeta(item.template);
  const unit = (item.unit || meta.unit) as StockUnit;
  const packSize = Number(item.packSize) || meta.defaultPackSize;
  const currentStock = Number(item.currentStock) || 0;
  const cost = Number(item.costPerSheet) || 0;

  return {
    ...item,
    _id: String(item._id),
    templateName: meta.name,
    unit,
    unitLabel: meta.unitLabel,
    packLabel: meta.packLabel,
    packSize,
    labelsPerUnit: meta.labelsPerUnit,
    totalValue: currentStock * cost,
    isLowStock: currentStock <= (Number(item.lowStockThreshold) || 0),
    daysLeft: forecast?.daysLeft ?? null,
    avgPerDay: forecast?.avgPerDay ?? 0,
    unitsBurned: forecast?.unitsBurned ?? 0,
    forecastWindowDays: forecast?.windowDays ?? 30,
  };
}
