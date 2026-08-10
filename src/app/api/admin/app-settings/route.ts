/**
 * GET  /api/admin/app-settings  — returns current app settings (Auth: any logged-in user)
 * PATCH /api/admin/app-settings  — updates settings (Auth: Admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { DEFAULT_NOTIFICATION_SETTINGS } from '@/lib/notifications';

export const DEFAULT_SETTINGS = {
  showSeedTestData:   false,
  showSeedCabinets:   false,
  showClearAllData:   false,
  showMigrateDrawers: false,
  ...DEFAULT_NOTIFICATION_SETTINGS,
  idleTimeoutEnabled: true,
  idleTimeoutMinutes: 15,
  idlePromptGraceSeconds: 60,
};

const BOOLEAN_KEYS = [
  'showSeedTestData',
  'showSeedCabinets',
  'showClearAllData',
  'showMigrateDrawers',
  'notifyLowStockEmail',
  'notifyIntakeIssuesEmail',
  'idleTimeoutEnabled',
] as const;

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = await clientPromise;
  const db = client.db('student-label');
  const doc = await db.collection('app_settings').findOne({ key: 'global' });

  return NextResponse.json({ ...DEFAULT_SETTINGS, ...(doc ?? {}), _id: undefined, key: undefined });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role !== 'Admin') {
    return NextResponse.json({ error: 'Forbidden — Admin only' }, { status: 403 });
  }

  const body = await req.json();
  const patch: Record<string, boolean | string | number> = {};

  for (const key of BOOLEAN_KEYS) {
    if (typeof body[key] === 'boolean') patch[key] = body[key];
  }
  if (typeof body.notificationRecipients === 'string') {
    patch.notificationRecipients = body.notificationRecipients.trim();
  }
  if (body.idleTimeoutMinutes !== undefined) {
    patch.idleTimeoutMinutes = clampInt(body.idleTimeoutMinutes, 1, 240, 15);
  }
  if (body.idlePromptGraceSeconds !== undefined) {
    patch.idlePromptGraceSeconds = clampInt(body.idlePromptGraceSeconds, 15, 300, 60);
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 });
  }

  const client = await clientPromise;
  const db = client.db('student-label');
  await db.collection('app_settings').updateOne(
    { key: 'global' },
    { $set: patch },
    { upsert: true },
  );

  const updated = await db.collection('app_settings').findOne({ key: 'global' });
  return NextResponse.json({ ...DEFAULT_SETTINGS, ...(updated ?? {}), _id: undefined, key: undefined });
}
