import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { isMotherDuckConfigured } from '@/lib/motherduck';
import { queryMotherDuckAnalytics } from '@/lib/motherduckAnalytics';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session || role !== 'Admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

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
