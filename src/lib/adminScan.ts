import type { Collection, Document, Filter } from 'mongodb';

/** Hard cap so admin diagnostic routes cannot load an entire district roster into memory. */
export const ADMIN_SCAN_STUDENT_CAP = 5_000;

export type CappedFindResult<T = Document> = {
  docs: T[];
  truncated: boolean;
  scanned: number;
  cap: number;
};

export async function findCapped<T = Document>(
  collection: Collection,
  query: Filter<Document>,
  options?: { projection?: Document; sort?: Document; cap?: number },
): Promise<CappedFindResult<T>> {
  const cap = options?.cap ?? ADMIN_SCAN_STUDENT_CAP;
  const cursor = collection.find(query);
  if (options?.projection) cursor.project(options.projection);
  if (options?.sort) cursor.sort(options.sort);
  const docs = (await cursor.limit(cap + 1).toArray()) as T[];
  const truncated = docs.length > cap;
  if (truncated) docs.pop();
  return { docs, truncated, scanned: docs.length, cap };
}

export function scanMeta(result: { truncated: boolean; scanned: number; cap: number }) {
  return {
    scanned: result.scanned,
    truncated: result.truncated,
    cap: result.cap,
  };
}
