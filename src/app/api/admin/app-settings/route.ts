/**
 * GET  /api/admin/app-settings  — returns current app settings (Auth: any logged-in user)
 * PATCH /api/admin/app-settings  — updates settings (Auth: Admin only)
 *
 * Settings document in MongoDB collection `app_settings` (singleton, key = "global"):
 * {
 *   key: "global",
 *   showSeedTestData:    boolean   // Seed Test Data button on Dashboard
 *   showSeedCabinets:    boolean   // Seed Smart Cabinets button on Dashboard
 *   showClearAllData:    boolean   // Clear All Data button on Dashboard
 *   showMigrateDrawers:  boolean   // Migrate Drawers link in Admin nav
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';

export const DEFAULT_SETTINGS = {
  showSeedTestData:   false,
  showSeedCabinets:   false,
  showClearAllData:   false,
  showMigrateDrawers: false,
};

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
  const role = (session?.user as any)?.role;
  if (!session || role !== 'Admin') {
    return NextResponse.json({ error: 'Forbidden — Admin only' }, { status: 403 });
  }

  const body = await req.json();
  const allowed = Object.keys(DEFAULT_SETTINGS) as (keyof typeof DEFAULT_SETTINGS)[];
  const patch: Record<string, boolean> = {};
  for (const key of allowed) {
    if (typeof body[key] === 'boolean') patch[key] = body[key];
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
