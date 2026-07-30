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

/** Tailwind classes for issue/warning chips by category (soft tint + border — readable for long messages). */
export function bulkIssueBadgeClass(
  category: BulkIssueCategory,
  kind: 'issue' | 'warning' = 'issue',
): string {
  // Override Badge's rounded-full / font-semibold for multi-line review chips
  const base =
    'rounded-md font-medium normal-case tracking-normal shadow-none '
    + 'w-fit max-w-[280px] text-xs whitespace-normal h-auto py-1 px-2 leading-snug border border-l-4';

  const byCat: Record<BulkIssueCategory, { issue: string; warning: string }> = {
    duplicate: {
      issue: 'bg-teal-50 text-teal-950 border-teal-200 border-l-teal-600 dark:bg-teal-950/40 dark:text-teal-100 dark:border-teal-800 dark:border-l-teal-400',
      warning: 'bg-teal-50/70 text-teal-900 border-teal-200/80 border-l-teal-400 dark:bg-teal-950/25 dark:text-teal-200 dark:border-teal-800',
    },
    date: {
      issue: 'bg-amber-50 text-amber-950 border-amber-200 border-l-amber-500 dark:bg-amber-950/40 dark:text-amber-100 dark:border-amber-800 dark:border-l-amber-400',
      warning: 'bg-amber-50/70 text-amber-900 border-amber-200/80 border-l-amber-400 dark:bg-amber-950/25 dark:text-amber-200 dark:border-amber-800',
    },
    email: {
      issue: 'bg-sky-50 text-sky-950 border-sky-200 border-l-sky-600 dark:bg-sky-950/40 dark:text-sky-100 dark:border-sky-800 dark:border-l-sky-400',
      warning: 'bg-sky-50/70 text-sky-900 border-sky-200/80 border-l-sky-400 dark:bg-sky-950/25 dark:text-sky-200 dark:border-sky-800',
    },
    status: {
      issue: 'bg-orange-50 text-orange-950 border-orange-200 border-l-orange-600 dark:bg-orange-950/40 dark:text-orange-100 dark:border-orange-800 dark:border-l-orange-400',
      warning: 'bg-orange-50/70 text-orange-900 border-orange-200/80 border-l-orange-400 dark:bg-orange-950/25 dark:text-orange-200 dark:border-orange-800',
    },
    required: {
      issue: 'bg-red-50 text-red-950 border-red-200 border-l-red-600 dark:bg-red-950/40 dark:text-red-100 dark:border-red-800 dark:border-l-red-400',
      warning: 'bg-red-50/70 text-red-900 border-red-200/80 border-l-red-400 dark:bg-red-950/25 dark:text-red-200 dark:border-red-800',
    },
    storage: {
      issue: 'bg-rose-50 text-rose-950 border-rose-200 border-l-rose-600 dark:bg-rose-950/40 dark:text-rose-100 dark:border-rose-800 dark:border-l-rose-400',
      warning: 'bg-rose-50/70 text-rose-900 border-rose-200/80 border-l-rose-400 dark:bg-rose-950/25 dark:text-rose-200 dark:border-rose-800',
    },
    other: {
      issue: 'bg-slate-50 text-slate-900 border-slate-200 border-l-slate-600 dark:bg-slate-900/50 dark:text-slate-100 dark:border-slate-700 dark:border-l-slate-400',
      warning: 'bg-slate-50/70 text-slate-800 border-slate-200/80 border-l-slate-400 dark:bg-slate-900/30 dark:text-slate-200 dark:border-slate-700',
    },
  };
  return `${base} ${byCat[category][kind]}`;
}

/** Input / select ring colors matching issue category */
export function bulkFieldIssueClass(category: BulkIssueCategory | null): string {
  if (!category) return '';
  const map: Record<BulkIssueCategory, string> = {
    duplicate: 'border-teal-500 ring-1 ring-teal-500/40 focus-visible:ring-teal-500',
    date: 'border-amber-500 ring-1 ring-amber-500/40 focus-visible:ring-amber-500',
    email: 'border-sky-500 ring-1 ring-sky-500/40 focus-visible:ring-sky-500',
    status: 'border-orange-500 ring-1 ring-orange-500/40 focus-visible:ring-orange-500',
    required: 'border-red-500 ring-1 ring-red-500/40 focus-visible:ring-red-500',
    storage: 'border-rose-500 ring-1 ring-rose-500/40 focus-visible:ring-rose-500',
    other: 'border-slate-500 ring-1 ring-slate-500/40 focus-visible:ring-slate-500',
  };
  return map[category];
}

export function bulkIssueCategoryLabel(category: BulkIssueCategory): string {
  switch (category) {
    case 'duplicate': return 'Duplicate';
    case 'date': return 'Date';
    case 'email': return 'Email';
    case 'status': return 'Status / FY';
    case 'required': return 'Required';
    case 'storage': return 'Storage';
    default: return 'Other';
  }
}

/** 1-based CSV row numbers (header = row 1, first data row = 2). */
export function csvRowNumber(previewIndex: number): number {
  return previewIndex + 2;
}
