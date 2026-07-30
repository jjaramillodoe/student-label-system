/**
 * Bulk-upload row quality checks for Data Leads.
 * Dates, within-file duplicates, and realistic DOB/start-date relationships.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export type BulkDateField = 'dob' | 'startDate';

export type BulkDateIssue = {
  field: BulkDateField | 'both';
  severity: 'error' | 'warning';
  message: string;
  /** Suggested corrected value when we can infer one */
  suggestion?: string;
};

export type BulkIssueCategory = 'duplicate' | 'date' | 'required' | 'status' | 'email' | 'storage' | 'other';

/** Parse YYYY-MM-DD as local calendar date (no timezone shift). */
export function parseBulkIsoDate(value: string): Date | null {
  const match = String(value ?? '').trim().match(ISO_DATE);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    Number.isNaN(date.getTime())
    || date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function isBulkIsoDate(value: unknown): boolean {
  return Boolean(parseBulkIsoDate(String(value ?? '')));
}

function ageOn(dob: Date, on: Date): number {
  let age = on.getFullYear() - dob.getFullYear();
  const m = on.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && on.getDate() < dob.getDate())) age -= 1;
  return age;
}

function daysBetween(a: Date, b: Date): number {
  const ms = startOfDay(b).getTime() - startOfDay(a).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function toIso(d: Date): string {
  return [
    String(d.getFullYear()).padStart(4, '0'),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

/**
 * Validate DOB + startDate for adult-ed bulk upload.
 * Catches the common export mistakes in sample CSVs (1881 DOB, startDate = DOB, etc.).
 */
export function checkBulkUploadDates(
  dobRaw: string,
  startRaw: string,
  opts?: { today?: Date; maxAge?: number; minAgeWarn?: number },
): BulkDateIssue[] {
  const today = opts?.today ?? new Date();
  const maxAge = opts?.maxAge ?? 100;
  const minAgeWarn = opts?.minAgeWarn ?? 16;
  const out: BulkDateIssue[] = [];

  const dob = parseBulkIsoDate(dobRaw);
  const start = parseBulkIsoDate(startRaw);

  if (dobRaw && !dob) {
    out.push({ field: 'dob', severity: 'error', message: 'Invalid DOB — use YYYY-MM-DD (or M/D/YYYY)' });
  }
  if (startRaw && !start) {
    out.push({
      field: 'startDate',
      severity: 'error',
      message: 'Invalid start date — use YYYY-MM-DD (or M/D/YYYY)',
    });
  }

  if (dob) {
    if (startOfDay(dob) > startOfDay(today)) {
      out.push({ field: 'dob', severity: 'error', message: 'DOB is in the future' });
    } else {
      const age = ageOn(dob, today);
      if (age > maxAge || dob.getFullYear() < 1920) {
        out.push({
          field: 'dob',
          severity: 'error',
          message: `DOB year ${dob.getFullYear()} looks like a data entry error (age ~${age})`,
        });
      } else if (age < minAgeWarn) {
        out.push({
          field: 'dob',
          severity: 'warning',
          message: `Student appears under ${minAgeWarn} (age ~${age}) — confirm DOB for adult education`,
        });
      } else if (age < 21) {
        out.push({
          field: 'dob',
          severity: 'warning',
          message: `Under 21 (age ~${age}) — not eligible for BE/ESL until 21st birthday`,
        });
      }
    }
  }

  if (start) {
    const futureDays = daysBetween(today, start);
    if (futureDays > 365) {
      out.push({
        field: 'startDate',
        severity: 'error',
        message: `Start date is more than a year in the future (${toIso(start)})`,
      });
    } else if (futureDays > 90) {
      out.push({
        field: 'startDate',
        severity: 'warning',
        message: `Start date is ${futureDays} days in the future — confirm it is correct`,
      });
    }
    // Start dates before ~1990 for adult ed are almost always wrong (often DOB pasted into startDate)
    if (start.getFullYear() < 1990) {
      out.push({
        field: 'startDate',
        severity: 'error',
        message: `Start date year ${start.getFullYear()} looks like a DOB pasted into startDate`,
      });
    }
  }

  if (dob && start) {
    if (toIso(dob) === toIso(start)) {
      out.push({
        field: 'both',
        severity: 'error',
        message: 'Start date equals DOB — almost always a data entry error',
      });
    } else if (startOfDay(start) < startOfDay(dob)) {
      out.push({
        field: 'both',
        severity: 'error',
        message: 'Start date is before DOB — impossible',
      });
    } else {
      const ageAtStart = ageOn(dob, start);
      if (ageAtStart < 14) {
        out.push({
          field: 'both',
          severity: 'error',
          message: `Would have been ~${ageAtStart} on start date — check DOB or start date`,
        });
      } else if (ageAtStart < 16) {
        out.push({
          field: 'both',
          severity: 'warning',
          message: `Would have been ~${ageAtStart} on start date — confirm both dates`,
        });
      }
    }
  }

  return out;
}

/** Classify a validation message for filters / summary chips. */
export function categorizeBulkIssue(message: string): BulkIssueCategory {
  const m = message.toLowerCase();
  if (m.includes('dup') || m.includes('same name') || m.includes('repeated') || m.includes('already in system') || m.includes('possible same person')) {
    return 'duplicate';
  }
  if (
    m.includes('dob')
    || m.includes('start date')
    || m.includes('date')
    || m.includes('age')
    || m.includes('birthday')
  ) {
    return 'date';
  }
  if (m.includes('missing first') || m.includes('missing last') || m.includes('missing cabinet') || m.includes('missing drawer')) {
    return 'required';
  }
  if (m.includes('status') || m.includes('fiscal year')) return 'status';
  if (m.includes('email')) return 'email';
  if (m.includes('drawer') || m.includes('cabinet') || m.includes('space')) return 'storage';
  return 'other';
}

export function isDuplicateIssue(message: string): boolean {
  return categorizeBulkIssue(message) === 'duplicate';
}

export function isDateIssue(message: string): boolean {
  return categorizeBulkIssue(message) === 'date';
}

/** 1-based CSV row numbers (header = row 1, first data row = 2). */
export function csvRowNumber(previewIndex: number): number {
  return previewIndex + 2;
}
