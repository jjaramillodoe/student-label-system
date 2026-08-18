import type { Db } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { classifySearchKind, type SearchKind } from '@/lib/studentSearch';

export const SEARCH_EVENTS_COLLECTION = 'search_events';

export const SEARCH_SOURCES = [
  'dashboard',
  'intake',
  'intake-check',
  'all-students',
  'command-palette',
  'lookup',
] as const;

export type SearchSource = (typeof SEARCH_SOURCES)[number];

export type SearchEventInput = {
  query: string;
  resultCount: number;
  source: string;
  school?: string | null;
  role?: string | null;
};

function normalizeSource(source: string | undefined): SearchSource {
  if (source && (SEARCH_SOURCES as readonly string[]).includes(source)) {
    return source as SearchSource;
  }
  return 'lookup';
}

let indexesReady: Promise<void> | null = null;

async function ensureIndexes(db: Db): Promise<void> {
  if (!indexesReady) {
    indexesReady = (async () => {
      const col = db.collection(SEARCH_EVENTS_COLLECTION);
      await Promise.all([
        col.createIndex({ at: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 }),
        col.createIndex({ school: 1, at: -1 }),
        col.createIndex({ source: 1, at: -1 }),
      ]);
    })().catch((err) => {
      indexesReady = null;
      console.error('[searchAnalytics] index create failed', err);
    });
  }
  await indexesReady;
}

/**
 * Persist a privacy-safe search event. Raw query text is never stored.
 */
export async function logSearchEvent(input: SearchEventInput): Promise<void> {
  const query = String(input.query || '').trim();
  if (!query) return;

  try {
    const client = await clientPromise;
    const db = client.db('student-label');
    await ensureIndexes(db);

    await db.collection(SEARCH_EVENTS_COLLECTION).insertOne({
      kind: classifySearchKind(query) as SearchKind,
      source: normalizeSource(input.source),
      resultCount: Math.max(0, Number(input.resultCount) || 0),
      zeroResults: Number(input.resultCount) <= 0,
      queryLength: Math.min(query.length, 200),
      school: input.school?.trim() || null,
      role: input.role?.trim() || null,
      at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[searchAnalytics] log failed', err);
  }
}

export function isSearchSource(value: unknown): value is SearchSource {
  return typeof value === 'string' && (SEARCH_SOURCES as readonly string[]).includes(value);
}
