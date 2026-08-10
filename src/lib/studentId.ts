/**
 * Student ID utilities
 *
 * labelId  — printed barcode on the physical label
 *            format: {birthYear}-{initials}-{7-digit counter}
 *            example: 1979-EC-0000048
 *
 * studentId — permanent demographic identifier stored in the DB
 *             Aligned with ASISTS export IDs:
 *             format: {LASTNAME}{FIRSTNAME}{AGENCYID}{D}{M}{YYYY}
 *             DOB day/month are not zero-padded (ASISTS style).
 *             example: CUEVAELSAR012251979  (Elsa Cueva, R01, 1979-05-22)
 *
 * When registering NEW from an ASISTS/legacy roster match, prefer the
 * roster externalId (may include an ASISTS internal number between agency
 * and DOB, e.g. SMITHFITZROYR082522026211958).
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
 * ASISTS-style DOB digits: day + month + year with no zero-padding.
 * "1979-05-22" → "2251979"
 * "1958-01-02" → "211958"
 */
export function formatAssistsDobDigits(dob: string): string {
  const iso = String(dob || '').trim();
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${day}${month}${year}`;
    }
  }
  // Fallback: strip non-digits (legacy callers / odd inputs)
  return iso.replace(/[^0-9]/g, '');
}

/**
 * Build the demographic student ID (ASISTS-aligned).
 * All components are cleaned and concatenated without separators.
 * Day/month are not zero-padded.
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
  const dobNum = formatAssistsDobDigits(dob);
  return `${last}${first}${agency}${dobNum}`;
}

/**
 * Prefer a cleaned ASISTS/legacy external ID when present; otherwise generate.
 */
export function resolveStudentId(params: {
  firstName: string;
  lastName: string;
  agencyId: string;
  dob: string;
  /** ASISTS / legacy roster ID when continuing as NEW from a match */
  preferredExternalId?: string | null;
}): string {
  const preferred = params.preferredExternalId
    ? cleanIdComponent(params.preferredExternalId)
    : '';
  if (preferred) return preferred;
  return generateStudentId(
    params.firstName,
    params.lastName,
    params.agencyId,
    params.dob,
  );
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
