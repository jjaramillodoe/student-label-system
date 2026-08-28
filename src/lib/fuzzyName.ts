/**
 * Shared fuzzy name-matching utilities used by:
 *   - /api/intake/check  (real-time duplicate check on intake form)
 *   - /api/admin/duplicates  (auto-detection on the review page)
 *
 * Key design goal: a student who omits their middle name (e.g. "Javier Jaramillo"
 * instead of "Javier Ernesto Jaramillo") with the same DOB should still surface as
 * a potential duplicate even though the raw edit-distance similarity is low (~0.68).
 *
 * Strategy (checked in order, any one hit returns true):
 *   1. Exact full-name match (same DOB) → always flag
 *   2. Token-subset: every word in the shorter full name appears (with fuzzy
 *      tolerance) somewhere in the longer full name, AND DOBs match.
 *   3. Last-name similarity ≥ 0.85 AND first-word-of-first-name similarity ≥ 0.80
 *      AND DOBs match.  Handles "Javier Jaramillo" vs "Javier Ernesto Jaramillo".
 *   4. Raw full-name edit-distance similarity ≥ 0.80 with same DOB.
 *   5. Raw full-name similarity ≥ 0.90 with DOBs within 1 year (data-entry swap).
 *   6. Last ≥ 0.90 AND first ≥ 0.60 with same DOB (catches inverted/swapped names).
 */

export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

/** Normalized edit-distance similarity in [0, 1] (1 = identical). */
export function nameSim(a: string, b: string): number {
  const na = a.toLowerCase().replace(/[^a-z]/g, '');
  const nb = b.toLowerCase().replace(/[^a-z]/g, '');
  const max = Math.max(na.length, nb.length);
  return max === 0 ? 1 : 1 - levenshtein(na, nb) / max;
}

/** Split a name string into cleaned lowercase tokens. */
function tokens(name: string): string[] {
  return name.toLowerCase().replace(/[^a-z ]/g, '').split(/\s+/).filter(Boolean);
}

/** First word of a potentially multi-word name (handles "Javier Ernesto" → "Javier"). */
function firstWord(name: string): string {
  return tokens(name)[0] ?? '';
}

/**
 * True if every token in `shorter` has a fuzzy match (≥ threshold) inside `longer`.
 * E.g. ["javier","jaramillo"] all appear in ["javier","ernesto","jaramillo"].
 */
function tokenSubsetMatch(shorter: string, longer: string, threshold = 0.80): boolean {
  const st = tokens(shorter);
  const lt = tokens(longer);
  if (st.length === 0 || lt.length === 0) return false;
  return st.every(tok => lt.some(ltTok => nameSim(tok, ltTok) >= threshold));
}

export interface StudentLike {
  firstName?: string;
  lastName?: string;
  dob?: string;
}

/**
 * Returns true when two student records look like the same person or close siblings
 * who warrant manual review.  Deliberately does NOT flag exact identical records
 * (same full name AND same DOB) — those are handled as exact duplicates separately.
 */
export function isPossibleDuplicate(a: StudentLike, b: StudentLike): boolean {
  const full1 = `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim();
  const full2 = `${b.firstName ?? ''} ${b.lastName ?? ''}`.trim();
  const sameDob = Boolean(a.dob && b.dob && a.dob === b.dob);

  // Exact name + exact DOB → true duplicate, not a "fuzzy" sibling match
  if (full1.toLowerCase() === full2.toLowerCase() && sameDob) return false;

  // ── 2. Token-subset with same DOB ─────────────────────────────────────────
  // Handles "Javier Jaramillo" ⊆ "Javier Ernesto Jaramillo"
  if (sameDob) {
    const [shorter, longer] = full1.length <= full2.length
      ? [full1, full2]
      : [full2, full1];
    if (tokenSubsetMatch(shorter, longer)) return true;
  }

  // ── 3. Last name + first token of first name with same DOB ────────────────
  // Handles middle-name omission regardless of how firstName is stored
  if (sameDob) {
    const lastSim = nameSim(a.lastName ?? '', b.lastName ?? '');
    const firstSim = nameSim(firstWord(a.firstName ?? ''), firstWord(b.firstName ?? ''));
    if (lastSim >= 0.85 && firstSim >= 0.80) return true;
  }

  // ── 4. Raw full-name edit distance with same DOB ──────────────────────────
  const fullSim = nameSim(full1, full2);
  if (sameDob && fullSim >= 0.80) return true;

  // ── 5. Raw full-name edit distance with near-matching DOB (year ± 1) ──────
  if (fullSim >= 0.90 && a.dob && b.dob) {
    const [y1, m1, d1] = a.dob.split('-');
    const [y2, m2, d2] = b.dob.split('-');
    if (m1 === m2 && d1 === d2 && Math.abs(Number(y1) - Number(y2)) <= 1) return true;
  }

  // ── 6. Last ≥ 0.90 AND first ≥ 0.60 with same DOB ────────────────────────
  if (sameDob) {
    const lastSim = nameSim(a.lastName ?? '', b.lastName ?? '');
    const firstSimFull = nameSim(a.firstName ?? '', b.firstName ?? '');
    if (lastSim >= 0.90 && firstSimFull >= 0.60) return true;
  }

  return false;
}

/** Last names similar enough to treat a shared DOB as possible siblings / twins. */
const FAMILY_LAST_NAME_SIM = 0.85;

/**
 * Floor for listing a same-DOB hit that is not a fuzzy duplicate, shared last name,
 * or shared address. A 7% "Marco Gomez" vs "Shirley Alarcon" coincidence stays hidden.
 */
export const MIN_INTAKE_REVIEW_MATCH_PERCENT = 50;

export function isLikelySameFamilyLastName(a: StudentLike, b: StudentLike): boolean {
  const lastA = (a.lastName ?? '').trim();
  const lastB = (b.lastName ?? '').trim();
  if (!lastA || !lastB) return false;
  return nameSim(lastA, lastB) >= FAMILY_LAST_NAME_SIM;
}

/**
 * Whether a same-DOB row belongs on the intake duplicate panel.
 * Shared birthday alone is not enough.
 */
export function shouldReviewSameDobMatch(
  incoming: StudentLike,
  existing: StudentLike,
  opts?: { sameAddress?: boolean; similarityPercent?: number },
): boolean {
  const sameDob = Boolean(incoming.dob && existing.dob && incoming.dob === existing.dob);
  if (!sameDob) return false;
  if (opts?.sameAddress) return true;
  if (isPossibleDuplicate(incoming, existing)) return true;
  if (isLikelySameFamilyLastName(incoming, existing)) return true;
  const pct = opts?.similarityPercent ?? matchPercent(
    { firstName: incoming.firstName ?? '', lastName: incoming.lastName ?? '' },
    existing,
  );
  return pct >= MIN_INTAKE_REVIEW_MATCH_PERCENT;
}

/**
 * Compute a human-readable similarity percentage for display in the UI.
 * Returns a number in [0, 100].
 */
export function matchPercent(
  incoming: { firstName: string; lastName: string },
  existing: StudentLike,
): number {
  const full1 = `${incoming.firstName} ${incoming.lastName}`.trim();
  const full2 = `${existing.firstName ?? ''} ${existing.lastName ?? ''}`.trim();

  // Token-subset case: use last+first word similarity instead of raw edit distance
  const [shorter, longer] = full1.length <= full2.length ? [full1, full2] : [full2, full1];
  if (tokenSubsetMatch(shorter, longer, 0.80)) {
    const lastSim = nameSim(incoming.lastName, existing.lastName ?? '');
    const firstSim = nameSim(firstWord(incoming.firstName), firstWord(existing.firstName ?? ''));
    return Math.round(((lastSim + firstSim) / 2) * 100);
  }

  return Math.round(nameSim(full1, full2) * 100);
}
