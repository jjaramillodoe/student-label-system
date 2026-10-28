import clientPromise from '@/lib/mongodb';
import {
  DELEGATE_BASE_ROLE,
  ROLE_DELEGATIONS_COLLECTION,
  activeDelegationFilter,
  type DelegationDoc,
} from '@/lib/delegation';

/**
 * Short in-memory cache so a Data Member's session does not query Mongo on every request.
 * Approvals and revokes reach a signed-in user within this window.
 */
const CACHE_MS = 60_000;
const cache = new Map<string, { at: number; endDate: string | null }>();

/** End date of the user's active delegation, or null when they are not acting as Data Lead. */
export async function activeDelegationEndDate(
  baseRole: string,
  email: string,
  school: string,
): Promise<string | null> {
  if (baseRole !== DELEGATE_BASE_ROLE || !email || !school) return null;
  const key = `${email.toLowerCase()}|${school}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.endDate;

  try {
    const client = await clientPromise;
    const doc = await client
      .db('student-label')
      .collection<DelegationDoc>(ROLE_DELEGATIONS_COLLECTION)
      .findOne(activeDelegationFilter(email, school), { projection: { endDate: 1 } });
    const endDate = doc?.endDate ?? null;
    cache.set(key, { at: Date.now(), endDate });
    return endDate;
  } catch (err) {
    console.error('[delegation] lookup failed', err);
    return hit?.endDate ?? null;
  }
}

/** Drop the cached answer after a change on this instance, so it applies right away here. */
export function forgetDelegationCache(email: string, school: string) {
  cache.delete(`${email.toLowerCase()}|${school}`);
}

export async function ensureDelegationIndexes() {
  const client = await clientPromise;
  const col = client.db('student-label').collection(ROLE_DELEGATIONS_COLLECTION);
  await col.createIndex({ userEmail: 1, school: 1, status: 1, endDate: 1 });
  await col.createIndex({ school: 1, requestedAt: -1 });
}
