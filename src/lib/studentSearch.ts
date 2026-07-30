/**
 * Build MongoDB $or conditions for student text search (name, IDs, DOB).
 * DOB is stored as YYYY-MM-DD; users may type slashes, dashes, or compact digits.
 * Free-text queries may combine name + DOB in one box (e.g. "Mary Smith 01/15/1990").
 */

const DOB_TAIL =
  /(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s*$/;

export function normalizeDobToIso(input: string): string | null {
  const trimmed = input.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const slash4 = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash4) {
    const [, m, d, y] = slash4;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const slash2 = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (slash2) {
    const [, m, d, yRaw] = slash2;
    const y = Number(yRaw) > 50 ? `19${yRaw}` : `20${yRaw.padStart(2, '0')}`;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const dash4 = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dash4) {
    const [, m, d, y] = dash4;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const dash2 = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{2})$/);
  if (dash2) {
    const [, m, d, yRaw] = dash2;
    const y = Number(yRaw) > 50 ? `19${yRaw}` : `20${yRaw.padStart(2, '0')}`;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const compact = trimmed.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (compact) {
    const [, m, d, y] = compact;
    return `${y}-${m}-${d}`;
  }

  return null;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function isStudentSearchQueryValid(query: string): boolean {
  const q = query.trim();
  if (!q) return false;
  if (q.length >= 2) return true;
  return normalizeDobToIso(q) !== null;
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
  let namePart = raw;
  let dobIso: string | null = null;

  const tail = raw.match(DOB_TAIL);
  if (tail) {
    const parsed = normalizeDobToIso(tail[1]);
    if (parsed) {
      dobIso = parsed;
      namePart = raw.slice(0, tail.index).trim();
    } else if (normalizeDobToIso(raw)) {
      // entire query is a date
      dobIso = normalizeDobToIso(raw);
      namePart = '';
    }
  } else {
    const onlyDob = normalizeDobToIso(raw);
    if (onlyDob) {
      dobIso = onlyDob;
      namePart = '';
    }
  }

  const tokens = namePart.split(/\s+/).filter(Boolean);
  const firstName = tokens[0] || '';
  const lastName = tokens.slice(1).join(' ');

  return { raw, namePart, firstName, lastName, dobIso };
}

export function buildStudentSearchOrConditions(search: string): Record<string, unknown>[] {
  const trimmed = search.trim();
  if (!trimmed) return [];

  const { namePart, firstName, lastName, dobIso } = parseStudentSearchQuery(trimmed);
  const or: Record<string, unknown>[] = [];

  const pushNameDobAnd = (fn: string, ln: string, dob: string | null) => {
    if (!fn && !ln && !dob) return;
    const and: Record<string, unknown>[] = [];
    if (fn) and.push({ firstName: { $regex: escapeRegex(fn), $options: 'i' } });
    if (ln) and.push({ lastName: { $regex: escapeRegex(ln), $options: 'i' } });
    if (dob) and.push({ dob });
    if (and.length === 1) or.push(and[0]);
    else if (and.length > 1) or.push({ $and: and });
  };

  // Prefer structured first + last (+ DOB) when the user typed a full name
  if (firstName && lastName) {
    pushNameDobAnd(firstName, lastName, dobIso);
    // Also try swapped in case they typed Last First
    pushNameDobAnd(lastName, firstName, dobIso);
  } else if (firstName && dobIso) {
    pushNameDobAnd(firstName, '', dobIso);
    or.push({
      $and: [
        { lastName: { $regex: escapeRegex(firstName), $options: 'i' } },
        { dob: dobIso },
      ],
    });
  } else if (dobIso && !namePart) {
    or.push({ dob: dobIso });
  }

  // Broad fallbacks on the full string / name part
  const broad = namePart || trimmed;
  const safe = escapeRegex(broad);
  const rx = { $regex: safe, $options: 'i' };
  or.push(
    { firstName: rx },
    { lastName: rx },
    { labelId: rx },
    { studentId: rx },
    { externalId: rx },
  );

  if (dobIso) {
    or.push({ dob: dobIso });
    or.push({ dob: { $regex: `^${escapeRegex(dobIso)}`, $options: 'i' } });
  }

  // Partial ISO prefix: 1963-03 or 1963
  if (/^\d{4}(-\d{1,2})?(-\d{1,2})?$/.test(trimmed)) {
    or.push({ dob: { $regex: `^${escapeRegex(trimmed)}`, $options: 'i' } });
  }

  // Raw DOB substring (e.g. user pasted part of a date)
  if (/[\d/-]/.test(trimmed)) {
    or.push({ dob: { $regex: safe, $options: 'i' } });
  }

  return or;
}
