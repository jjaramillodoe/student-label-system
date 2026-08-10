/**
 * Build MongoDB $or conditions for student text search (name, IDs, DOB).
 * DOB is stored as YYYY-MM-DD; users may type slashes, dashes, or compact digits.
 * Free-text queries may combine name + DOB in one box (e.g. "Mary Smith 01/15/1990").
 *
 * Important: DOB-only queries must NOT fall back to name/labelId regex on year
 * fragments (e.g. "1979/05/22" must not become name "19" matching every labelId).
 */

/** Trailing DOB token: ISO, YYYY/MM/DD, or US MM/DD/YYYY (2- or 4-digit year). */
const DOB_TAIL =
  /(\d{4}[/-]\d{1,2}[/-]\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{8})\s*$/;

function pad2(n: number | string): string {
  return String(n).padStart(2, '0');
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const d = new Date(year, month - 1, day);
  return (
    d.getFullYear() === year
    && d.getMonth() === month - 1
    && d.getDate() === day
  );
}

function toIsoIfValid(year: number, month: number, day: number): string | null {
  if (!isValidCalendarDate(year, month, day)) return null;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function expandTwoDigitYear(yRaw: string): number {
  const n = Number(yRaw);
  // School adults: 00–30 → 2000s, 31–99 → 1900s
  return n <= 30 ? 2000 + n : 1900 + n;
}

/**
 * Normalize a date string to YYYY-MM-DD, or null if not a recognizable / valid date.
 * Accepts: YYYY-MM-DD, YYYY/MM/DD, MM/DD/YYYY, MM-DD-YYYY, MM/DD/YY, MMDDYYYY.
 */
export function normalizeDobToIso(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Already ISO
  let m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    return toIsoIfValid(Number(m[1]), Number(m[2]), Number(m[3]));
  }

  // YYYY/MM/DD (common when pasting from spreadsheets)
  m = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (m) {
    return toIsoIfValid(Number(m[1]), Number(m[2]), Number(m[3]));
  }

  // MM/DD/YYYY
  m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    return toIsoIfValid(Number(m[3]), Number(m[1]), Number(m[2]));
  }

  // MM/DD/YY
  m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (m) {
    return toIsoIfValid(expandTwoDigitYear(m[3]), Number(m[1]), Number(m[2]));
  }

  // MM-DD-YYYY (US with dashes — only when first segment is a valid month)
  m = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) {
    const month = Number(m[1]);
    const day = Number(m[2]);
    const year = Number(m[3]);
    // Prefer US MM-DD-YYYY when month looks like a month; otherwise treat as YYYY-MM-DD below
    if (month >= 1 && month <= 12) {
      const us = toIsoIfValid(year, month, day);
      if (us) return us;
    }
  }

  // YYYY-M-D / YYYY-MM-D (partial padding)
  m = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    return toIsoIfValid(Number(m[1]), Number(m[2]), Number(m[3]));
  }

  // MM-DD-YY
  m = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{2})$/);
  if (m) {
    return toIsoIfValid(expandTwoDigitYear(m[3]), Number(m[1]), Number(m[2]));
  }

  // Compact MMDDYYYY
  m = trimmed.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (m) {
    return toIsoIfValid(Number(m[3]), Number(m[1]), Number(m[2]));
  }

  return null;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function isStudentSearchQueryValid(query: string): boolean {
  const q = query.trim();
  if (!q) return false;
  if (normalizeDobToIso(q) !== null) return true;
  return q.length >= 2;
}

/** Split a free-text intake search into name tokens + optional DOB. */
export function parseStudentSearchQuery(search: string): {
  raw: string;
  namePart: string;
  firstName: string;
  lastName: string;
  dobIso: string | null;
} {
  const raw = search.trim().replace(/\s+/g, ' ');

  // Whole query is a date (any supported format)
  const onlyDob = normalizeDobToIso(raw);
  if (onlyDob) {
    return { raw, namePart: '', firstName: '', lastName: '', dobIso: onlyDob };
  }

  let namePart = raw;
  let dobIso: string | null = null;

  const tail = raw.match(DOB_TAIL);
  if (tail && typeof tail.index === 'number') {
    const parsed = normalizeDobToIso(tail[1]);
    if (parsed) {
      const before = raw.slice(0, tail.index).trim();
      // Reject stripping a digit-only "name" prefix (e.g. "19" from broken YYYY/MM/DD parse)
      if (!before || !/^\d+$/.test(before)) {
        dobIso = parsed;
        namePart = before;
      }
    }
  }

  const tokens = namePart.split(/\s+/).filter(Boolean);
  const firstName = tokens[0] || '';
  const lastName = tokens.slice(1).join(' ');

  return { raw, namePart, firstName, lastName, dobIso };
}

/**
 * Mongo $or clauses for student / legacy roster search.
 *
 * Modes:
 * - DOB only → exact DOB match (plus ISO regex safety)
 * - Name + DOB → name AND dob (also try swapped first/last)
 * - Name only → name / labelId / studentId / externalId regex
 */
export function buildStudentSearchOrConditions(search: string): Record<string, unknown>[] {
  const trimmed = search.trim();
  if (!trimmed) return [];

  const { namePart, firstName, lastName, dobIso } = parseStudentSearchQuery(trimmed);
  const or: Record<string, unknown>[] = [];

  const pushAnd = (parts: Record<string, unknown>[]) => {
    if (parts.length === 1) or.push(parts[0]);
    else if (parts.length > 1) or.push({ $and: parts });
  };

  // ── DOB-only: never OR against name/labelId (year digits false-positive) ──
  if (dobIso && !namePart) {
    or.push({ dob: dobIso });
    or.push({ dob: { $regex: `^${escapeRegex(dobIso)}$`, $options: 'i' } });
    return or;
  }

  // ── Name + DOB: require both sides ──
  if (dobIso && (firstName || lastName)) {
    if (firstName && lastName) {
      pushAnd([
        { firstName: { $regex: `^${escapeRegex(firstName)}`, $options: 'i' } },
        { lastName: { $regex: escapeRegex(lastName), $options: 'i' } },
        { dob: dobIso },
      ]);
      // Swapped Last First
      pushAnd([
        { firstName: { $regex: `^${escapeRegex(lastName)}`, $options: 'i' } },
        { lastName: { $regex: escapeRegex(firstName), $options: 'i' } },
        { dob: dobIso },
      ]);
    } else if (firstName) {
      pushAnd([
        { firstName: { $regex: escapeRegex(firstName), $options: 'i' } },
        { dob: dobIso },
      ]);
      pushAnd([
        { lastName: { $regex: escapeRegex(firstName), $options: 'i' } },
        { dob: dobIso },
      ]);
    }
    return or;
  }

  // ── Name / ID only ──
  const broad = namePart || trimmed;
  // Skip pure numeric fragments shorter than a real ID (avoids "19" / "1979" name spam)
  if (/^\d{1,4}$/.test(broad)) {
    // Year-only: match DOB prefix, not every labelId containing those digits
    or.push({ dob: { $regex: `^${escapeRegex(broad)}`, $options: 'i' } });
    return or;
  }

  const safe = escapeRegex(broad);
  const rx = { $regex: safe, $options: 'i' };
  or.push(
    { firstName: rx },
    { lastName: rx },
    { labelId: rx },
    { studentId: rx },
    { externalId: rx },
  );

  // Multi-token: also try first + last as AND without DOB
  if (firstName && lastName) {
    pushAnd([
      { firstName: { $regex: escapeRegex(firstName), $options: 'i' } },
      { lastName: { $regex: escapeRegex(lastName), $options: 'i' } },
    ]);
  }

  return or;
}
