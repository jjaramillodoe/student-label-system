import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireSession';
import { isMotherDuckConfigured } from '@/lib/motherduck';
import { syncStudentsToMotherDuck } from '@/lib/motherduckSync';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Admin-only: full snapshot sync of MongoDB students → MotherDuck. */
export async function POST() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  if (!isMotherDuckConfigured()) {
    return NextResponse.json(
      { error: 'MotherDuck is not configured. Set MOTHERDUCK_TOKEN.' },
      { status: 503 },
    );
  }

  try {
    const result = await syncStudentsToMotherDuck();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[motherduck/sync]', err);
    return NextResponse.json(
      {
        error: 'MotherDuck sync failed',
        details: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
