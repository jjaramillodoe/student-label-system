import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireSession';
import { getSystemStats } from '@/lib/systemStats';

export const dynamic = 'force-dynamic';

/** Admin-only read-only system and database statistics */
export async function GET() {
  const auth = await requireAdmin('Forbidden — Admin only');
  if (!auth.ok) return auth.response;

  try {
    const stats = await getSystemStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching system stats:', error);
    return NextResponse.json({ error: 'Failed to fetch system statistics' }, { status: 500 });
  }
}
