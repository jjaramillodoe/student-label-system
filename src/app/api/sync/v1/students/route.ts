import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { validateSyncAuth } from '@/lib/syncAuth';
import {
  buildCursorQuery,
  buildDeltaSinceQuery,
  decodeSyncCursor,
  encodeSyncCursor,
  getSourceLastModified,
  toSyncStudentDto,
} from '@/lib/syncStudent';
import { logSyncExport } from '@/lib/syncExportLog';
import {
  SYNC_RATE,
  clientIp,
  consumeRateLimit,
  rateLimitResponse,
} from '@/lib/rateLimit';

const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 1000;

function parseLimit(raw: string | null): number {
  const parsed = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

function parseSince(raw: string | null): string | NextResponse {
  if (!raw) {
    return new Date(0).toISOString();
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return NextResponse.json({ error: 'Invalid since parameter (expected ISO date)' }, { status: 400 });
  }

  return parsed.toISOString();
}

export async function GET(req: NextRequest) {
  const limited = consumeRateLimit({
    key: `sync:${clientIp(req)}`,
    ...SYNC_RATE,
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const auth = validateSyncAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const sinceParam = parseSince(req.nextUrl.searchParams.get('since'));
  if (sinceParam instanceof NextResponse) return sinceParam;

  const limit = parseLimit(req.nextUrl.searchParams.get('limit'));
  const cursorParam = req.nextUrl.searchParams.get('cursor');
  const cursor = cursorParam ? decodeSyncCursor(cursorParam) : null;

  if (cursorParam && !cursor) {
    return NextResponse.json({ error: 'Invalid cursor parameter' }, { status: 400 });
  }

  try {
    const client = await clientPromise;
    const col = client.db('student-label').collection('students');

    const query = cursor
      ? buildCursorQuery(sinceParam, cursor)
      : buildDeltaSinceQuery(sinceParam);

    const docs = await col
      .find(query)
      .sort({ updatedAt: 1, _id: 1 })
      .limit(limit + 1)
      .toArray();

    const hasMore = docs.length > limit;
    const page = hasMore ? docs.slice(0, limit) : docs;
    const students = page.map((doc) => toSyncStudentDto(doc as Record<string, unknown>));

    const lastDoc = page[page.length - 1];
    const nextCursor =
      hasMore && lastDoc
        ? encodeSyncCursor({
            sourceLastModified: getSourceLastModified(
              lastDoc as { updatedAt?: string | null; createdAt?: string | null }
            ),
            sourceMongoId: String(lastDoc._id),
          })
        : null;

    const response = {
      students,
      hasMore,
      nextCursor,
      since: sinceParam,
      count: students.length,
    };

    void logSyncExport({
      since: sinceParam,
      recordCount: students.length,
      hasMore,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('Sync students error:', error);
    return NextResponse.json({ error: 'Failed to fetch sync students' }, { status: 500 });
  }
}
