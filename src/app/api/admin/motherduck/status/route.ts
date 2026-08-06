import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import {
  getMotherDuckDatabase,
  getMotherDuckHost,
  isMotherDuckConfigured,
  pingMotherDuck,
} from '@/lib/motherduck';
import { motherduckQuery } from '@/lib/motherduck';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session || role !== 'Admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const configured = isMotherDuckConfigured();
  if (!configured) {
    return NextResponse.json({
      configured: false,
      connected: false,
      host: getMotherDuckHost(),
      database: getMotherDuckDatabase(),
      studentCount: null,
      lastSyncedAt: null,
      message: 'Set MOTHERDUCK_TOKEN (and optionally MOTHERDUCK_DATABASE) to enable.',
    });
  }

  const ping = await pingMotherDuck();
  let studentCount: number | null = null;
  let lastSyncedAt: string | null = null;

  if (ping.ok) {
    try {
      const [countRows, syncRows] = await Promise.all([
        motherduckQuery<{ count: number }>('SELECT COUNT(*)::INTEGER AS count FROM students'),
        motherduckQuery<{ value: string }>(
          `SELECT value FROM sync_meta WHERE key = 'students_last_synced_at' LIMIT 1`,
        ),
      ]);
      studentCount = Number(countRows[0]?.count) || 0;
      lastSyncedAt = syncRows[0]?.value || null;
    } catch {
      // schema may be empty mid-setup
    }
  }

  return NextResponse.json({
    configured: true,
    connected: ping.ok,
    latencyMs: ping.latencyMs,
    host: getMotherDuckHost(),
    database: ping.database || getMotherDuckDatabase(),
    studentCount,
    lastSyncedAt,
    message: ping.message,
  });
}
