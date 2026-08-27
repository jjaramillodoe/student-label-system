import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/requireSession';
import { isSearchSource, logSearchEvent } from '@/lib/searchAnalytics';
import { isStudentSearchQueryValid } from '@/lib/studentSearch';
import { logAppEvent, requestLogFields } from '@/lib/appLog';

/** Client-side search logging (dashboard / command palette). */
export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

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
      school: auth.user?.school || null,
      role: auth.user?.role || null,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logAppEvent('error', 'search_event_failed', {
      ...requestLogFields({
        requestId: req.headers.get('x-request-id'),
        route: '/api/search-events',
        method: 'POST',
        role: auth.user?.role,
        school: auth.user?.school,
      }),
      error: err instanceof Error ? err.message : 'unknown',
    });
    return NextResponse.json({ error: 'Failed to record search' }, { status: 500 });
  }
}
