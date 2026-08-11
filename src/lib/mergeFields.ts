/**
 * Field-level merge helpers for Admin → Duplicates.
 * Data Leads choose primary vs secondary per scalar field and for the address group.
 */

export type MergeSource = 'primary' | 'secondary';

export type MergeScalarKey =
  | 'email'
  | 'phone'
  | 'gender'
  | 'program'
  | 'notes'
  | 'fiscalYear'
  | 'startDate';

export const MERGE_SCALAR_FIELDS: Array<{ key: MergeScalarKey; label: string }> = [
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'gender', label: 'Gender' },
  { key: 'program', label: 'Program' },
  { key: 'notes', label: 'Notes' },
  { key: 'fiscalYear', label: 'Fiscal year' },
  { key: 'startDate', label: 'Start date' },
];

/** Address + verification metadata kept together. */
export const ADDRESS_GROUP_FIELDS = [
  'address',
  'apt',
  'city',
  'state',
  'zip',
  'addressValidationStatus',
  'addressGeoclient',
] as const;

export type AddressGroupField = (typeof ADDRESS_GROUP_FIELDS)[number];

export const ADDRESS_GROUP_KEY = 'addressGroup' as const;

export type MergeFieldChoices = Partial<Record<MergeScalarKey | typeof ADDRESS_GROUP_KEY, MergeSource>>;

export type MergeFieldStatus = 'same' | 'conflict' | 'only_primary' | 'only_secondary' | 'both_empty';

export type MergeFieldDiffRow = {
  key: MergeScalarKey | typeof ADDRESS_GROUP_KEY;
  label: string;
  status: MergeFieldStatus;
  primaryDisplay: string;
  secondaryDisplay: string;
  defaultChoice: MergeSource;
};

function isEmptyValue(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (typeof v === 'object') return Object.keys(v as object).length === 0;
  return false;
}

function displayScalar(v: unknown): string {
  if (isEmptyValue(v)) return '—';
  return String(v).trim();
}

function addressGroupDisplay(student: Record<string, unknown>): string {
  const street = [student.address, student.apt].filter((p) => !isEmptyValue(p)).join(', ');
  const cityLine = [student.city, student.state, student.zip]
    .filter((p) => !isEmptyValue(p))
    .join(' ');
  const line = [street, cityLine].filter(Boolean).join(' · ');
  if (!line) return '—';
  const status = student.addressValidationStatus
    ? ` (${String(student.addressValidationStatus)})`
    : '';
  return `${line}${status}`;
}

function addressGroupEmpty(student: Record<string, unknown>): boolean {
  return ADDRESS_GROUP_FIELDS.every((f) => isEmptyValue(student[f]));
}

function addressGroupEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  return ADDRESS_GROUP_FIELDS.every((f) => {
    const av = isEmptyValue(a[f]) ? '' : String(a[f]).trim().toLowerCase();
    const bv = isEmptyValue(b[f]) ? '' : String(b[f]).trim().toLowerCase();
    // Skip geoclient object deep-compare — use status + street fields
    if (f === 'addressGeoclient') return true;
    return av === bv;
  });
}

function statusFor(primaryVal: unknown, secondaryVal: unknown): MergeFieldStatus {
  const pEmpty = isEmptyValue(primaryVal);
  const sEmpty = isEmptyValue(secondaryVal);
  if (pEmpty && sEmpty) return 'both_empty';
  if (pEmpty) return 'only_secondary';
  if (sEmpty) return 'only_primary';
  if (String(primaryVal).trim().toLowerCase() === String(secondaryVal).trim().toLowerCase()) {
    return 'same';
  }
  return 'conflict';
}

function defaultChoiceFor(status: MergeFieldStatus): MergeSource {
  if (status === 'only_secondary') return 'secondary';
  return 'primary';
}

export function buildMergeFieldDiff(
  primary: Record<string, unknown>,
  secondary: Record<string, unknown>,
): MergeFieldDiffRow[] {
  const rows: MergeFieldDiffRow[] = MERGE_SCALAR_FIELDS.map(({ key, label }) => {
    const status = statusFor(primary[key], secondary[key]);
    return {
      key,
      label,
      status,
      primaryDisplay: displayScalar(primary[key]),
      secondaryDisplay: displayScalar(secondary[key]),
      defaultChoice: defaultChoiceFor(status),
    };
  });

  const pEmpty = addressGroupEmpty(primary);
  const sEmpty = addressGroupEmpty(secondary);
  let addrStatus: MergeFieldStatus;
  if (pEmpty && sEmpty) addrStatus = 'both_empty';
  else if (pEmpty) addrStatus = 'only_secondary';
  else if (sEmpty) addrStatus = 'only_primary';
  else if (addressGroupEqual(primary, secondary)) addrStatus = 'same';
  else addrStatus = 'conflict';

  rows.push({
    key: ADDRESS_GROUP_KEY,
    label: 'Home address',
    status: addrStatus,
    primaryDisplay: addressGroupDisplay(primary),
    secondaryDisplay: addressGroupDisplay(secondary),
    defaultChoice: defaultChoiceFor(addrStatus),
  });

  return rows;
}

export function buildDefaultFieldChoices(
  primary: Record<string, unknown>,
  secondary: Record<string, unknown>,
): Record<MergeScalarKey | typeof ADDRESS_GROUP_KEY, MergeSource> {
  const diff = buildMergeFieldDiff(primary, secondary);
  const choices = {} as Record<MergeScalarKey | typeof ADDRESS_GROUP_KEY, MergeSource>;
  for (const row of diff) {
    choices[row.key] = row.defaultChoice;
  }
  return choices;
}

export type AppliedFieldChange = {
  field: string;
  previous: unknown;
  next: unknown;
};

/**
 * Build $set payload from Data Lead choices.
 * Only fields taken from secondary (that actually change primary) are applied.
 */
export function applyMergeFieldChoices(
  primary: Record<string, unknown>,
  secondary: Record<string, unknown>,
  choices: MergeFieldChoices | null | undefined,
): { setFields: Record<string, unknown>; changes: AppliedFieldChange[] } {
  const setFields: Record<string, unknown> = {};
  const changes: AppliedFieldChange[] = [];

  const resolved = choices && typeof choices === 'object'
    ? { ...buildDefaultFieldChoices(primary, secondary), ...choices }
    : buildDefaultFieldChoices(primary, secondary);

  for (const { key } of MERGE_SCALAR_FIELDS) {
    if (resolved[key] !== 'secondary') continue;
    const next = secondary[key];
    if (isEmptyValue(next)) continue;
    const previous = primary[key];
    if (String(previous ?? '').trim() === String(next ?? '').trim()) continue;
    setFields[key] = next;
    changes.push({ field: key, previous: previous ?? null, next });
  }

  if (resolved[ADDRESS_GROUP_KEY] === 'secondary' && !addressGroupEmpty(secondary)) {
    for (const field of ADDRESS_GROUP_FIELDS) {
      const next = secondary[field];
      // Always copy address core fields from secondary when group chosen;
      // clear verification on primary if secondary lacks it
      const previous = primary[field];
      const same =
        field === 'addressGeoclient'
          ? JSON.stringify(previous ?? null) === JSON.stringify(next ?? null)
          : String(previous ?? '').trim() === String(next ?? '').trim();
      if (same) continue;
      if (isEmptyValue(next)) {
        // Unset via separate path — use null sentinel for undo restore
        setFields[field] = null;
        changes.push({ field, previous: previous ?? null, next: null });
      } else {
        setFields[field] = next;
        changes.push({ field, previous: previous ?? null, next });
      }
    }
  }

  return { setFields, changes };
}

/** Legacy fill-if-missing when client sends no fieldChoices. */
export function applyFillIfMissing(
  primary: Record<string, unknown>,
  secondary: Record<string, unknown>,
): { setFields: Record<string, unknown>; changes: AppliedFieldChange[] } {
  const keys: string[] = [
    ...MERGE_SCALAR_FIELDS.map((f) => f.key),
    ...ADDRESS_GROUP_FIELDS,
  ];
  const setFields: Record<string, unknown> = {};
  const changes: AppliedFieldChange[] = [];
  for (const field of keys) {
    if (!isEmptyValue(primary[field]) || isEmptyValue(secondary[field])) continue;
    setFields[field] = secondary[field];
    changes.push({ field, previous: null, next: secondary[field] });
  }
  return { setFields, changes };
}

export function isValidMergeChoices(raw: unknown): raw is MergeFieldChoices {
  if (!raw || typeof raw !== 'object') return false;
  const allowed = new Set<string>([
    ...MERGE_SCALAR_FIELDS.map((f) => f.key),
    ADDRESS_GROUP_KEY,
  ]);
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!allowed.has(k)) return false;
    if (v !== 'primary' && v !== 'secondary') return false;
  }
  return true;
}

/** Contact + address fields used for the “more complete” hint. */
const COMPLETENESS_FIELDS = [
  'email',
  'phone',
  'gender',
  'program',
  'notes',
  'fiscalYear',
  'startDate',
  'address',
  'apt',
  'city',
  'state',
  'zip',
] as const;

export type CompletenessScore = {
  filled: number;
  total: number;
  pct: number;
};

export function completenessScore(student: Record<string, unknown>): CompletenessScore {
  let filled = 0;
  for (const key of COMPLETENESS_FIELDS) {
    if (!isEmptyValue(student[key])) filled += 1;
  }
  const total = COMPLETENESS_FIELDS.length;
  return {
    filled,
    total,
    pct: Math.round((filled / total) * 100),
  };
}

export function hasDrawerLocation(student: Record<string, unknown>): boolean {
  return !isEmptyValue(student.cabinet) && !isEmptyValue(student.drawer);
}

export function canTransferDrawer(
  primary: Record<string, unknown>,
  secondary: Record<string, unknown>,
): boolean {
  return !hasDrawerLocation(primary) && hasDrawerLocation(secondary);
}

export const LOCATION_TRANSFER_FIELDS = [
  'cabinet',
  'drawer',
  'drawerSection',
] as const;

function nameTokens(student: Record<string, unknown>): string[] {
  const full = `${student.firstName ?? ''} ${student.lastName ?? ''}`.trim().toLowerCase();
  return full.replace(/[^a-z ]/g, '').split(/\s+/).filter(Boolean);
}

function nameLetterCount(student: Record<string, unknown>): number {
  return `${student.firstName ?? ''}${student.lastName ?? ''}`.toLowerCase().replace(/[^a-z]/g, '').length;
}

/**
 * Soft warnings when the chosen primary looks less complete or inconsistent
 * compared to the secondary (Data Lead should verify before merging).
 */
export function primaryQualityWarnings(
  primary: Record<string, unknown>,
  secondary: Record<string, unknown>,
): string[] {
  const warnings: string[] = [];
  const pTokens = nameTokens(primary);
  const sTokens = nameTokens(secondary);
  const pLetters = nameLetterCount(primary);
  const sLetters = nameLetterCount(secondary);

  if (sTokens.length > pTokens.length && sLetters >= pLetters + 3) {
    warnings.push(
      'Secondary name looks more complete (extra middle name or longer spelling). Consider switching primary, or confirm the shorter name is correct.',
    );
  } else if (pLetters > 0 && sLetters > pLetters + 4) {
    warnings.push(
      'Secondary name spelling is longer — check for typos or omitted middle names on the primary.',
    );
  }

  const pDob = String(primary.dob ?? '').trim();
  const sDob = String(secondary.dob ?? '').trim();
  if (pDob && sDob && pDob !== sDob) {
    warnings.push(
      `DOB differs (primary ${pDob} vs secondary ${sDob}). Merge keeps the primary DOB — confirm before continuing.`,
    );
  } else if (!pDob && sDob) {
    warnings.push(
      'Primary is missing DOB while secondary has one. Merge keeps the primary record’s DOB field as-is.',
    );
  }

  const pScore = completenessScore(primary);
  const sScore = completenessScore(secondary);
  if (sScore.filled >= pScore.filled + 3) {
    warnings.push(
      `Secondary has more filled contact/address fields (${sScore.filled}/${sScore.total} vs ${pScore.filled}/${pScore.total}). You can still keep this primary and pick fields below.`,
    );
  }

  return warnings;
}
