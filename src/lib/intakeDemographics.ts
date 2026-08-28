/** Intake ISRF demographics: employment, race/ethnicity, barriers, and contact extras. */

export const EMPLOYMENT_STATUS_OPTIONS = [
  { value: 'employed-full-time', label: 'Employed Full Time', pdf: 'Employed Full Time' },
  { value: 'employed-part-time', label: 'Employed Part Time', pdf: 'Employed Part Time' },
  {
    value: 'employed-termination-notice',
    label: 'Employed but Received Notice of Termination',
    pdf: 'Employed but Received Notice of Termination',
  },
  { value: 'military-separation-pending', label: 'Military Separation Pending', pdf: 'Military Separation Pending' },
  {
    value: 'unemployed-seeking',
    label: 'Unemployed & Seeking Employment',
    // Template checkbox title uses two spaces and no ampersand.
    pdf: 'Unemployed  Seeking Employment',
  },
  { value: 'not-available', label: 'Not Available for Employment', pdf: 'Not Available for Employment' },
  { value: 'inmate', label: 'Inmate', pdf: 'Inmate' },
] as const;

export type EmploymentStatusValue = (typeof EMPLOYMENT_STATUS_OPTIONS)[number]['value'];

export const HISPANIC_LATINO_OPTIONS = [
  // FY2027 template mislabels this radio as Male/Female. Top bubble = Hispanic.
  { value: 'hispanic', label: 'Hispanic/Latino/a', pdfOption: 'Male' },
  { value: 'non-hispanic', label: 'Non-Hispanic/Latino/a', pdfOption: 'Female' },
] as const;

export type HispanicLatinoValue = (typeof HISPANIC_LATINO_OPTIONS)[number]['value'];

export const RACE_IDENTITY_OPTIONS = [
  { value: 'native-hawaiian', label: 'Native Hawaiian', pdf: 'Native Hawaiian' },
  { value: 'native-american', label: 'Native American', pdf: 'Native American' },
  { value: 'alaskan-native', label: 'Alaskan Native', pdf: 'Alaskan Native' },
  { value: 'asian', label: 'Asian', pdf: 'Asian' },
  { value: 'pacific-islander', label: 'Pacific Islander', pdf: 'Pacific Islander' },
  { value: 'african-american', label: 'African American', pdf: 'African American' },
  { value: 'afro-caribbean', label: 'Afro-Caribbean', pdf: 'AfroCaribbean' },
  { value: 'african', label: 'African', pdf: 'African' },
  { value: 'latino', label: 'Latino/a', pdf: 'Latinoa' },
  { value: 'white-not-latino', label: 'White (not Latino/a)', pdf: 'White not Latinoa' },
] as const;

export type RaceIdentityValue = (typeof RACE_IDENTITY_OPTIONS)[number]['value'];

export type BarrierAnswer = 'Y' | 'N' | '';

/** Left bubble on the FY2027 Yes/No pairs is Yes. */
export const INTAKE_BARRIERS = [
  { key: 'isHomeless', label: 'Homeless', pdfField: 'Homeless', yes: 'Choice1', no: 'Choice2' },
  { key: 'isJusticeInvolved', label: 'Justice Involved', pdfField: 'Ex-Offender', yes: 'Choice1', no: 'Choice2' },
  { key: 'isDisplacedHomemaker', label: 'Displaced Homemaker', pdfField: 'Displaced Homemaker', yes: 'Choice1', no: 'Choice2' },
  { key: 'isYouthInFosterCare', label: 'Youth in Foster Care / Aged out of System', pdfField: 'Youth Foster', yes: 'Choice3', no: 'Choice4' },
  { key: 'isDisabled', label: 'Disabled', pdfField: 'Disabled1', yes: 'Choice3', no: 'Choice4' },
  { key: 'hasCulturalBarriers', label: 'Cultural Barriers to Learning', pdfField: 'Cultural Barriers', yes: 'Choice1', no: 'Choice2' },
  { key: 'isLowIncome', label: 'Low Income', pdfField: 'Low Income', yes: 'Choice1', no: 'Choice2' },
  { key: 'isLongTermUnemployed', label: 'Long-Term Unemployed', pdfField: 'Long-Term Unemployed', yes: 'Choice3', no: 'Choice4' },
  { key: 'isMigrantSeasonalWorker', label: 'Migrant / Seasonal Worker', pdfField: 'Migrant Seasonal', yes: 'Choice3', no: 'Choice4' },
  { key: 'isExhaustingTanf', label: 'Exhausting TANF within 2 years', pdfField: 'Exhausting TANF', yes: 'Choice1', no: 'Choice2' },
  { key: 'isLearningDisabled', label: 'Learning Disabled', pdfField: 'Learning Disabled', yes: 'Choice1', no: 'Choice2' },
  { key: 'isSingleParent', label: 'Single Parent', pdfField: 'Single Parent', yes: 'Choice3', no: 'Choice4' },
  { key: 'isRunawayYouth', label: 'Runaway Youth', pdfField: 'Runwaway Youth', yes: 'Choice3', no: 'Choice4' },
  { key: 'hasLowLiteracy', label: 'Low Levels of Literacy', pdfField: 'Low Levels Literacy', yes: 'Choice1', no: 'Choice2' },
  { key: 'hasUnsuccessfulHseSubtests', label: 'Unsuccessful Outcome on HSE Subtest(s)', pdfField: 'Unsuccessful Outcome', yes: 'Choice1', no: 'Choice2' },
  { key: 'isEnglishLanguageLearner', label: 'English Language Learner', pdfField: 'English Language Leraner', yes: 'Choice3', no: 'Choice4' },
  { key: 'isNonNativeEnglishSpeaker', label: 'Non-Native English Speaker', pdfField: 'Non Native English', yes: 'Choice3', no: 'Choice4' },
] as const;

export type BarrierKey = (typeof INTAKE_BARRIERS)[number]['key'];

const EMPLOYMENT_VALUES = new Set<string>(EMPLOYMENT_STATUS_OPTIONS.map((o) => o.value));
const HISPANIC_VALUES = new Set<string>(HISPANIC_LATINO_OPTIONS.map((o) => o.value));
const RACE_VALUES = new Set<string>(RACE_IDENTITY_OPTIONS.map((o) => o.value));

export function emptyBarrierAnswers(): Record<BarrierKey, BarrierAnswer> {
  return Object.fromEntries(INTAKE_BARRIERS.map((b) => [b.key, ''])) as Record<BarrierKey, BarrierAnswer>;
}

export function normalizeMiddleInitial(value: string | null | undefined): string {
  return String(value ?? '').replace(/[^A-Za-z]/g, '').slice(0, 1).toUpperCase();
}

export function isEmploymentStatus(value: string): value is EmploymentStatusValue {
  return EMPLOYMENT_VALUES.has(value);
}

export function isHispanicLatinoOrigin(value: string): value is HispanicLatinoValue {
  return HISPANIC_VALUES.has(value);
}

export function isRaceIdentity(value: string): value is RaceIdentityValue {
  return RACE_VALUES.has(value);
}

export function normalizeRaceIdentities(value: unknown): RaceIdentityValue[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<RaceIdentityValue>();
  for (const item of value) {
    if (typeof item === 'string' && isRaceIdentity(item) && !seen.has(item)) seen.add(item);
  }
  return [...seen];
}

export function normalizeBarrierAnswer(value: unknown): BarrierAnswer {
  const raw = String(value ?? '').trim().toUpperCase();
  if (raw === 'Y' || raw === 'YES' || raw === 'TRUE' || raw === '1') return 'Y';
  if (raw === 'N' || raw === 'NO' || raw === 'FALSE' || raw === '0') return 'N';
  return '';
}

export type IntakeDemographicsInput = {
  middleInitial?: string | null;
  homePhone?: string | null;
  phone?: string | null;
  cellPhone?: string | null;
  homePhoneSameAsCell?: boolean;
  emergencyContactNameRelationship?: string | null;
  emergencyContactPhone?: string | null;
  employmentStatus?: string | null;
  hispanicLatinoOrigin?: string | null;
  raceIdentities?: unknown;
} & Partial<Record<BarrierKey, unknown>>;

export type IntakeDemographicsPersist = {
  middleInitial?: string;
  homePhone?: string;
  cellPhone?: string;
  phone?: string;
  homePhoneSameAsCell?: boolean;
  emergencyContactNameRelationship?: string;
  emergencyContactPhone?: string;
  employmentStatus?: EmploymentStatusValue;
  hispanicLatinoOrigin?: HispanicLatinoValue;
  raceIdentities?: RaceIdentityValue[];
} & Partial<Record<BarrierKey, 'Y' | 'N'>>;

function trimPhone(value: string | null | undefined): string {
  return String(value ?? '').trim();
}

/** Home phone is the renamed intake phone; fall back to legacy `phone`. */
export function resolveHomePhone(input: {
  homePhone?: string | null;
  phone?: string | null;
}): string {
  return trimPhone(input.homePhone) || trimPhone(input.phone);
}

export function intakeDemographicsError(
  input: IntakeDemographicsInput,
  opts: { required: boolean },
): string | null {
  const mi = normalizeMiddleInitial(input.middleInitial);
  if (String(input.middleInitial ?? '').trim() && !mi) {
    return 'Middle initial must be a single letter A–Z.';
  }

  if (!opts.required) return null;

  const employment = String(input.employmentStatus ?? '').trim();
  if (!isEmploymentStatus(employment)) {
    return 'Select an employment status.';
  }

  const origin = String(input.hispanicLatinoOrigin ?? '').trim();
  if (!isHispanicLatinoOrigin(origin)) {
    return 'Select Hispanic / Latino origin.';
  }

  if (normalizeRaceIdentities(input.raceIdentities).length < 1) {
    return 'Select at least one race / identity.';
  }

  const unanswered = INTAKE_BARRIERS.filter((b) => normalizeBarrierAnswer(input[b.key]) === '');
  if (unanswered.length > 0) {
    return `Answer Yes or No for every barrier (${unanswered[0].label}).`;
  }

  return null;
}

export function parseIntakeDemographics(
  input: IntakeDemographicsInput,
  opts: { required: boolean },
): { values: IntakeDemographicsPersist; error: string | null } {
  const error = intakeDemographicsError(input, opts);
  if (error) return { values: {}, error };

  const cellPhone = trimPhone(input.cellPhone);
  const same = input.homePhoneSameAsCell === true;
  const homePhone = same ? cellPhone : resolveHomePhone(input);
  const employment = String(input.employmentStatus ?? '').trim();
  const origin = String(input.hispanicLatinoOrigin ?? '').trim();
  const raceIdentities = normalizeRaceIdentities(input.raceIdentities);
  const middleInitial = normalizeMiddleInitial(input.middleInitial);

  const values: IntakeDemographicsPersist = {};
  if (middleInitial) values.middleInitial = middleInitial;
  if (homePhone) {
    values.homePhone = homePhone;
    values.phone = homePhone;
  }
  if (cellPhone) values.cellPhone = cellPhone;
  if (same) values.homePhoneSameAsCell = true;
  const emergencyName = String(input.emergencyContactNameRelationship ?? '').trim();
  const emergencyPhone = trimPhone(input.emergencyContactPhone);
  if (emergencyName) values.emergencyContactNameRelationship = emergencyName;
  if (emergencyPhone) values.emergencyContactPhone = emergencyPhone;
  if (isEmploymentStatus(employment)) values.employmentStatus = employment;
  if (isHispanicLatinoOrigin(origin)) values.hispanicLatinoOrigin = origin;
  if (raceIdentities.length) values.raceIdentities = raceIdentities;
  for (const barrier of INTAKE_BARRIERS) {
    const answer = normalizeBarrierAnswer(input[barrier.key]);
    if (answer === 'Y' || answer === 'N') values[barrier.key] = answer;
  }
  return { values, error: null };
}

export function applyIntakeDemographics(
  target: Record<string, unknown>,
  values: IntakeDemographicsPersist,
): void {
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) target[key] = value;
  }
}
