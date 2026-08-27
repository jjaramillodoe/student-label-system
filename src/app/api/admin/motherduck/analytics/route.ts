import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireSession';
import { isMotherDuckConfigured } from '@/lib/motherduck';
import { queryMotherDuckAnalytics } from '@/lib/motherduckAnalytics';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  if (!isMotherDuckConfigured()) {
    return NextResponse.json(
      { error: 'MotherDuck is not configured. Set MOTHERDUCK_TOKEN.' },
      { status: 503 },
    );
  }

  try {
    const data = await queryMotherDuckAnalytics();
    return NextResponse.json({ ...data, scope: 'district', school: null });
  } catch (err) {
    console.error('[motherduck/analytics]', err);
    return NextResponse.json(
      {
        error: 'Failed to query MotherDuck',
        details: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
