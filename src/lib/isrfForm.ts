import { parseCalendarDate } from '@/lib/utils';
import {
  EMPLOYMENT_STATUS_OPTIONS,
  HISPANIC_LATINO_OPTIONS,
  INTAKE_BARRIERS,
  RACE_IDENTITY_OPTIONS,
  normalizeBarrierAnswer,
  normalizeMiddleInitial,
  normalizeRaceIdentities,
  resolveHomePhone,
  type BarrierKey,
  type HispanicLatinoValue,
} from '@/lib/intakeDemographics';

export const ISRF_ROLES = ['Admin', 'Data Lead', 'Data Member'] as const;

export const ISRF_TEMPLATE_RELATIVE_PATH = 'public/pdf_templates/ISRF FY2027.pdf';

export type IsrfStudentInput = {
  firstName?: string | null;
  lastName?: string | null;
  middleInitial?: string | null;
  dob?: string | null;
  originalStartDate?: string | null;
  startDate?: string | null;
  address?: string | null;
  apt?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  homePhone?: string | null;
  phone?: string | null;
  cellPhone?: string | null;
  email?: string | null;
  gender?: string | null;
  educationStatus?: string | null;
  emergencyContactNameRelationship?: string | null;
  emergencyContactPhone?: string | null;
  employmentStatus?: string | null;
  hispanicLatinoOrigin?: string | null;
  raceIdentities?: unknown;
} & Partial<Record<BarrierKey, string | null>>;

export type IsrfFillContext = {
  completedBy?: string | null;
  signedOn?: string | null;
};

export type IsrfFieldValues = {
  text: Record<string, string>;
  radios: Record<string, string>;
  checkboxes: Record<string, boolean>;
};

/**
 * Format a calendar date as MMDDYYYY.
 * Birth Date, Original Program Start Date, and date of signature are MaxLen=8.
 */
export function formatIsrfDate(value: string | null | undefined): string {
  const trimmed = String(value ?? '').trim();
  if (/^\d{8}$/.test(trimmed)) return trimmed;
  const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    return `${slash[1].padStart(2, '0')}${slash[2].padStart(2, '0')}${slash[3]}`;
  }
  const date = parseCalendarDate(trimmed);
  if (!date) return '';
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${mm}${dd}${date.getFullYear()}`;
}

/** Show an ISRF date box (MMDDYYYY) as MM/DD/YYYY in the UI. */
export function displayIsrfDateBox(value: string | null | undefined): string {
  const box = String(value ?? '').replace(/\D/g, '');
  if (box.length !== 8) return String(value ?? '').trim();
  return `${box.slice(0, 2)}/${box.slice(2, 4)}/${box.slice(4)}`;
}

export function todayIsrfDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  const year = parts.find((p) => p.type === 'year')?.value ?? '';
  return month && day && year ? `${month}${day}${year}` : '';
}

/** Split a US phone into area / exchange / line for the three ISRF boxes. */
export function splitUsPhone(phone: string | null | undefined): [string, string, string] {
  const digits = String(phone ?? '').replace(/\D/g, '');
  const d = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (d.length >= 10) return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 10)];
  return ['', '', ''];
}

export function normalizeIsrfGender(gender: string | null | undefined): 'Male' | 'Female' | '' {
  const raw = String(gender ?? '').trim().toLowerCase();
  if (raw === 'm' || raw === 'male') return 'Male';
  if (raw === 'f' || raw === 'female') return 'Female';
  return '';
}

function text(value: string | null | undefined): string {
  return String(value ?? '').trim();
}

/**
 * Map a student intake record onto named AcroForm fields in ISRF FY2027.pdf.
 */
export function buildIsrfFieldValues(
  student: IsrfStudentInput,
  ctx: IsrfFillContext = {},
): IsrfFieldValues {
  const homeParts = splitUsPhone(resolveHomePhone(student));
  const cellParts = splitUsPhone(student.cellPhone);
  const emergencyParts = splitUsPhone(student.emergencyContactPhone);
  const street = [text(student.address), text(student.apt)].filter(Boolean).join(', ');
  const gender = normalizeIsrfGender(student.gender);
  const program = text(student.educationStatus).toUpperCase();
  const start = formatIsrfDate(student.originalStartDate) || formatIsrfDate(student.startDate);

  const radios: Record<string, string> = {};
  if (gender) radios['Gender Required'] = gender;

  const origin = text(student.hispanicLatinoOrigin) as HispanicLatinoValue | '';
  const hispanic = HISPANIC_LATINO_OPTIONS.find((o) => o.value === origin);
  if (hispanic) radios['Hispanic/Latino'] = hispanic.pdfOption;

  for (const barrier of INTAKE_BARRIERS) {
    const answer = normalizeBarrierAnswer(student[barrier.key]);
    if (answer === 'Y') radios[barrier.pdfField] = barrier.yes;
    else if (answer === 'N') radios[barrier.pdfField] = barrier.no;
  }

  // Legacy records: infer ELL / low literacy from BE/ESL when those barriers were never asked.
  if (!normalizeBarrierAnswer(student.isEnglishLanguageLearner) && program === 'ESL') {
    radios['English Language Leraner'] = 'Choice3';
  }
  if (!normalizeBarrierAnswer(student.hasLowLiteracy) && program === 'BE') {
    radios['Low Levels Literacy'] = 'Choice1';
  }

  const checkboxes: Record<string, boolean> = {};
  const employment = EMPLOYMENT_STATUS_OPTIONS.find((o) => o.value === text(student.employmentStatus));
  if (employment) checkboxes[employment.pdf] = true;
  for (const race of normalizeRaceIdentities(student.raceIdentities)) {
    const opt = RACE_IDENTITY_OPTIONS.find((o) => o.value === race);
    if (opt) checkboxes[opt.pdf] = true;
  }

  return {
    text: {
      'First Name': text(student.firstName),
      MI: normalizeMiddleInitial(student.middleInitial),
      'Last Name': text(student.lastName),
      'Birth Date': formatIsrfDate(student.dob),
      'Original Program Start Date': start,
      Address: street,
      City: text(student.city),
      State: text(student.state).slice(0, 2).toUpperCase(),
      Zip: text(student.zip).replace(/\D/g, '').slice(0, 5),
      Phone: homeParts[0],
      undefined: homeParts[1],
      undefined_2: homeParts[2],
      Mobile: cellParts[0],
      undefined_3: cellParts[1],
      undefined_4: cellParts[2],
      email: text(student.email),
      'of Contact': text(student.emergencyContactNameRelationship),
      Emergency: emergencyParts[0],
      undefined_5: emergencyParts[1],
      undefined_6: emergencyParts[2],
      'Form Completed By Please Print': text(ctx.completedBy),
      'date of signature': formatIsrfDate(ctx.signedOn),
    },
    radios,
    checkboxes,
  };
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Map a Mongo student document onto the ISRF filler input. */
export function studentDocToIsrfInput(doc: Record<string, unknown> | null | undefined): IsrfStudentInput {
  if (!doc) return {};
  const input: IsrfStudentInput = {
    firstName: asString(doc.firstName),
    lastName: asString(doc.lastName),
    middleInitial: asString(doc.middleInitial),
    dob: asString(doc.dob),
    originalStartDate: asString(doc.originalStartDate),
    startDate: asString(doc.startDate),
    address: asString(doc.address),
    apt: asString(doc.apt),
    city: asString(doc.city),
    state: asString(doc.state),
    zip: asString(doc.zip),
    homePhone: asString(doc.homePhone),
    phone: asString(doc.phone),
    cellPhone: asString(doc.cellPhone),
    email: asString(doc.email),
    gender: asString(doc.gender),
    educationStatus: asString(doc.educationStatus),
    emergencyContactNameRelationship: asString(doc.emergencyContactNameRelationship),
    emergencyContactPhone: asString(doc.emergencyContactPhone),
    employmentStatus: asString(doc.employmentStatus),
    hispanicLatinoOrigin: asString(doc.hispanicLatinoOrigin),
    raceIdentities: Array.isArray(doc.raceIdentities) ? doc.raceIdentities : [],
  };
  for (const barrier of INTAKE_BARRIERS) {
    input[barrier.key] = asString(doc[barrier.key]);
  }
  return input;
}

export function isrfDownloadFilename(student: {
  lastName?: string | null;
  firstName?: string | null;
  studentId?: string | null;
  labelId?: string | null;
}): string {
  const slug = [student.lastName, student.firstName, student.studentId || student.labelId]
    .map((part) => String(part ?? '').replace(/[^\w-]+/g, '').trim())
    .filter(Boolean)
    .join('-')
    .slice(0, 80);
  return slug ? `ISRF-${slug}.pdf` : 'ISRF.pdf';
}
