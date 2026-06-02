import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getSystemStats } from '@/lib/systemStats';

export const dynamic = 'force-dynamic';

/** Admin-only read-only system and database statistics */
export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;

  if (!session || role !== 'Admin') {
    return NextResponse.json({ error: 'Forbidden — Admin only' }, { status: 403 });
  }

  try {
    const stats = await getSystemStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching system stats:', error);
    return NextResponse.json({ error: 'Failed to fetch system statistics' }, { status: 500 });
  }
}
