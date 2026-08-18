import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { isSearchSource, logSearchEvent } from '@/lib/searchAnalytics';
import { isStudentSearchQueryValid } from '@/lib/studentSearch';

/** Client-side search logging (dashboard / command palette). */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const query = typeof body.query === 'string' ? body.query : '';
    const source = typeof body.source === 'string' ? body.source : '';
    const resultCount = Number(body.resultCount);

    if (!isStudentSearchQueryValid(query) || !isSearchSource(source)) {
      return NextResponse.json({ error: 'Invalid search event' }, { status: 400 });
    }

    await logSearchEvent({
      query,
      resultCount: Number.isFinite(resultCount) ? resultCount : 0,
      source,
      school: session.user?.school || null,
      role: session.user?.role || null,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to record search' }, { status: 500 });
  }
}
