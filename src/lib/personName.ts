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

/** Lowercase full name for search / sort (still Last First). */
export function formatFullNameLower(
  personOrFirst: NameParts | string | null | undefined,
  lastNameArg?: string | null,
): string {
  return formatFullName(personOrFirst, lastNameArg).toLowerCase();
}
