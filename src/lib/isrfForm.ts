import { parseCalendarDate } from '@/lib/utils';

export const ISRF_ROLES = ['Admin', 'Data Lead', 'Data Member'] as const;

export const ISRF_TEMPLATE_RELATIVE_PATH = 'public/pdf_templates/ISRF FY2027.pdf';

export type IsrfStudentInput = {
  firstName?: string | null;
  lastName?: string | null;
  dob?: string | null;
  originalStartDate?: string | null;
  startDate?: string | null;
  address?: string | null;
  apt?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  phone?: string | null;
  email?: string | null;
  gender?: string | null;
  educationStatus?: string | null;
};

export type IsrfFillContext = {
  completedBy?: string | null;
  signedOn?: string | null;
};

export type IsrfFieldValues = {
  text: Record<string, string>;
  radios: Record<string, string>;
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
 * Barriers / employment / SSN / ethnicity are left blank — we do not collect them.
 */
export function buildIsrfFieldValues(
  student: IsrfStudentInput,
  ctx: IsrfFillContext = {},
): IsrfFieldValues {
  const phoneParts = splitUsPhone(student.phone);
  const street = [text(student.address), text(student.apt)].filter(Boolean).join(', ');
  const gender = normalizeIsrfGender(student.gender);
  const program = text(student.educationStatus).toUpperCase();
  const start = formatIsrfDate(student.originalStartDate) || formatIsrfDate(student.startDate);

  const radios: Record<string, string> = {};
  if (gender) radios['Gender Required'] = gender;
  // Left option on the Yes/No pairs is the “Yes” bubble on this template.
  if (program === 'ESL') radios['English Language Leraner'] = 'Choice3';
  if (program === 'BE') radios['Low Levels Literacy'] = 'Choice1';

  return {
    text: {
      'First Name': text(student.firstName),
      'Last Name': text(student.lastName),
      'Birth Date': formatIsrfDate(student.dob),
      'Original Program Start Date': start,
      Address: street,
      City: text(student.city),
      State: text(student.state).slice(0, 2).toUpperCase(),
      Zip: text(student.zip).replace(/\D/g, '').slice(0, 5),
      Phone: phoneParts[0],
      undefined: phoneParts[1],
      undefined_2: phoneParts[2],
      email: text(student.email),
      'Form Completed By Please Print': text(ctx.completedBy),
      'date of signature': formatIsrfDate(ctx.signedOn),
    },
    radios,
  };
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
