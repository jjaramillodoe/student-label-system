import { NextRequest, NextResponse } from 'next/server';
import { loadPublicArchiveBox } from '@/lib/loadPublicArchiveBox';
import {
  LOOKUP_RATE,
  clientIp,
  consumeRateLimit,
  rateLimitResponse,
} from '@/lib/rateLimit';

/**
 * GET /api/archive/box?boxId=...
 *
 * Public endpoint — no authentication required.
 * Returns archive box metadata and name + filing IDs for students in the box.
 * Does not include DOB, email, address, or notes.
 */
export async function GET(req: NextRequest) {
  try {
    const limited = consumeRateLimit({
      key: `archive-box:${clientIp(req)}`,
      ...LOOKUP_RATE,
    });
    if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

    const boxId = req.nextUrl.searchParams.get('boxId')?.trim();
    if (!boxId) {
      return NextResponse.json({ error: 'boxId query param required' }, { status: 400 });
    }

    const data = await loadPublicArchiveBox(boxId);
    if (!data) {
      return NextResponse.json({ error: 'Archive box not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error looking up archive box:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
