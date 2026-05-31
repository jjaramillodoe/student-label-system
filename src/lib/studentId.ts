/**
 * Student ID utilities
 *
 * labelId  — printed barcode on the physical label
 *            format: {birthYear}-{initials}-{7-digit counter}
 *            example: 1979-EC-0000048
 *
 * studentId — permanent demographic identifier stored in the DB
 *             format: {LASTNAME}{FIRSTNAME}{AGENCYID}{DOBDIGITS}  (all caps, alphanumeric only)
 *             example: CUEVAELSAR0119790522
 */

/**
 * Normalize a string component for use in studentId:
 * - Decompose unicode so accented chars become base letter + diacritic
 * - Strip diacritics and non-alphanumeric characters
 * - Uppercase
 */
export function cleanIdComponent(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // strip diacritics (é→e, ñ→n, etc.)
    .replace(/[^a-zA-Z0-9]/g, '')     // remove anything not letter/digit
    .toUpperCase();
}

/**
 * Build the demographic student ID.
 * All components are cleaned and concatenated without separators.
 */
export function generateStudentId(
  firstName: string,
  lastName: string,
  agencyId: string,
  dob: string,
): string {
  const last   = cleanIdComponent(lastName);
  const first  = cleanIdComponent(firstName);
  const agency = cleanIdComponent(agencyId);
  const dobNum = dob.replace(/[^0-9]/g, ''); // "1979-05-22" → "19790522"
  return `${last}${first}${agency}${dobNum}`;
}

/**
 * Build the label barcode ID.
 * format: {birthYear}-{firstInitial}{lastInitial}-{7-digit counter}
 */
export function generateLabelId(
  firstName: string,
  lastName: string,
  dob: string,
  counter: number,
): string {
  const initials  = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
  const birthYear = String(dob).split('-')[0] || String(new Date().getFullYear());
  return `${birthYear}-${initials}-${String(counter).padStart(7, '0')}`;
}

/**
 * Default agency ID fallback map.
 * Admins should set agencyId on each school record in School Configuration.
 * This map is only used when a school has no agencyId saved yet.
 */
export const DEFAULT_AGENCY_IDS: Record<string, string> = {
  'district 79': 'R00',
  'school 1':    'R01',
  'school 2':    'R02',
  'school 3':    'R03',
  'school 4':    'R04',
  'school 5':    'R05',
  'school 6':    'R06',
  'school 7':    'R07',
  'school 8':    'R08',
};

/**
 * Resolve agency ID for a school name.
 * Priority: DB-stored value → DEFAULT_AGENCY_IDS → derived "R??" from trailing digits.
 */
export function resolveAgencyId(schoolName: string, storedAgencyId?: string): string {
  if (storedAgencyId) return storedAgencyId;
  const lower = (schoolName || '').toLowerCase().trim();
  if (DEFAULT_AGENCY_IDS[lower]) return DEFAULT_AGENCY_IDS[lower];
  // Derive from trailing number: "School 12" → "R12"
  const numMatch = lower.match(/(\d+)\s*$/);
  if (numMatch) return `R${numMatch[1].padStart(2, '0')}`;
  return 'R00';
}
