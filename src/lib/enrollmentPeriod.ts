import {
  schoolDayStartUtc,
  todayDayKey,
} from '@/lib/intakeCalendar';

export type EnrollmentPeriod = 'today' | 'week' | 'month' | 'year' | 'all';
export type EnrollmentPeriodUnit = Exclude<EnrollmentPeriod, 'all'>;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function mondayOnOrBefore(dayKey: string): string {
  const [year, month, day] = dayKey.split('-').map(Number);
  const utcNoon = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const weekday = utcNoon.getUTCDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  utcNoon.setUTCDate(utcNoon.getUTCDate() + diff);
  return `${utcNoon.getUTCFullYear()}-${pad2(utcNoon.getUTCMonth() + 1)}-${pad2(utcNoon.getUTCDate())}`;
}

export function schoolPeriodStartDayKey(
  unit: EnrollmentPeriodUnit,
  now: Date = new Date(),
): string {
  const today = todayDayKey(now);
  const [year, month] = today.split('-').map(Number);
  if (unit === 'today') return today;
  if (unit === 'month') return `${year}-${pad2(month)}-01`;
  if (unit === 'year') return `${year}-01-01`;
  return mondayOnOrBefore(today);
}

/** Inclusive lower bound for Today / This Week / This Month / This Year in school time. */
export function schoolPeriodStartUtc(
  unit: EnrollmentPeriodUnit,
  now: Date = new Date(),
): Date {
  return schoolDayStartUtc(schoolPeriodStartDayKey(unit, now));
}

export function parseEnrollmentPeriod(value: string | null): EnrollmentPeriod {
  if (value === 'today' || value === 'week' || value === 'month' || value === 'year' || value === 'all') {
    return value;
  }
  return 'month';
}

/**
 * Match students with a first registration OR any intake visit in the period.
 * Returning visits on older files should appear in Today / This Month.
 */
export function enrollmentPeriodMongoFilter(start: Date | null): Record<string, unknown> {
  if (!start) return {};
  const iso = start.toISOString();
  return {
    $or: [
      { createdAt: { $gte: iso } },
      { createdAt: { $gte: start } },
      { 'intakeVisits.date': { $gte: iso } },
      { 'intakeVisits.date': { $gte: start } },
    ],
  };
}

function toTime(value: unknown): number | null {
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isNaN(t) ? null : t;
  }
  if (typeof value === 'string' && value.trim()) {
    const t = new Date(value).getTime();
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

export function hasEnrollmentActivitySince(
  doc: {
    createdAt?: unknown;
    intakeVisits?: Array<{ date?: unknown }>;
  },
  start: Date,
): boolean {
  const startMs = start.getTime();
  const created = toTime(doc.createdAt);
  if (created !== null && created >= startMs) return true;
  for (const visit of doc.intakeVisits ?? []) {
    const visitAt = toTime(visit.date);
    if (visitAt !== null && visitAt >= startMs) return true;
  }
  return false;
}
