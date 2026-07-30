/** Display person names as Last First (Adult Ed / filing convention). */

export type NameParts = {
  firstName?: string | null;
  lastName?: string | null;
};

/**
 * Format a full name as "LastName FirstName".
 * Accepts either a person object or (firstName, lastName) args.
 */
export function formatFullName(
  personOrFirst: NameParts | string | null | undefined,
  lastNameArg?: string | null,
): string {
  let first = '';
  let last = '';

  if (personOrFirst && typeof personOrFirst === 'object') {
    first = String(personOrFirst.firstName ?? '').trim();
    last = String(personOrFirst.lastName ?? '').trim();
  } else {
    first = String(personOrFirst ?? '').trim();
    last = String(lastNameArg ?? '').trim();
  }

  return [last, first].filter(Boolean).join(' ');
}

/**
 * Label print format: "LastName, FirstName" (comma for filing clarity).
 */
export function formatLabelName(
  personOrFirst: NameParts | string | null | undefined,
  lastNameArg?: string | null,
): string {
  let first = '';
  let last = '';

  if (personOrFirst && typeof personOrFirst === 'object') {
    first = String(personOrFirst.firstName ?? '').trim();
    last = String(personOrFirst.lastName ?? '').trim();
  } else {
    first = String(personOrFirst ?? '').trim();
    last = String(lastNameArg ?? '').trim();
  }

  if (last && first) return `${last}, ${first}`;
  return last || first;
}

/** Print-batch sequence as 5 digits: 1 → "00001". */
export function formatLabelSequence(sequence: number): string {
  if (!Number.isFinite(sequence) || sequence < 1) return '';
  return String(Math.floor(sequence)).padStart(5, '0');
}

/**
 * 1-based sequence among students that have a first name, for print index `index`
 * in a (possibly padded) sheet array. Returns undefined for empty slots.
 */
export function labelSequenceAtIndex(
  students: Array<{ firstName?: string | null } | null | undefined>,
  index: number,
): number | undefined {
  const current = students[index];
  if (!current?.firstName?.trim()) return undefined;
  let n = 0;
  for (let i = 0; i <= index; i++) {
    if (students[i]?.firstName?.trim()) n += 1;
  }
  return n;
}

/** Lowercase full name for search / sort (still Last First). */
export function formatFullNameLower(
  personOrFirst: NameParts | string | null | undefined,
  lastNameArg?: string | null,
): string {
  return formatFullName(personOrFirst, lastNameArg).toLowerCase();
}
