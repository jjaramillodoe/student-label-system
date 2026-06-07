/**
 * EPE Clock — half-hour rounding for intake attendance.
 *
 * - :00–:14 → round down to :00
 * - :15–:44 → round to :30
 * - :45–:59 → round up to next hour :00
 */

import { visitDayKey } from '@/lib/intakeVisitValidation';

export type EpeVisitLike = {
  date?: string;
  timeIn?: unknown;
  timeOut?: unknown | null;
  isLeaving?: string;
};

export function parseMinutesOfDay(t: unknown): number | null {
  if (typeof t !== 'string') return null;
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (isNaN(h) || isNaN(min) || h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

export function roundEpeMinutesOfDay(minutesOfDay: number): number {
  const normalized = ((minutesOfDay % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;

  if (m <= 14) return h * 60;
  if (m <= 44) return h * 60 + 30;
  return ((h + 1) % 24) * 60;
}

export function roundEpeTime(t: unknown): number | null {
  const mins = parseMinutesOfDay(t);
  if (mins === null) return null;
  return roundEpeMinutesOfDay(mins);
}

/** Duration between EPE-rounded time-in and time-out (handles past-midnight rollover). */
export function epeVisitDurationMinutes(timeIn: unknown, timeOut: unknown): number | null {
  const a = parseMinutesOfDay(timeIn);
  const b = parseMinutesOfDay(timeOut);
  if (a === null || b === null) return null;

  const roundedA = roundEpeMinutesOfDay(a);
  const roundedB = roundEpeMinutesOfDay(b);
  let diff = roundedB - roundedA;
  if (diff < 0) diff += 24 * 60;
  return diff;
}

function isVisitClockedOut(v: EpeVisitLike): boolean {
  if (v.isLeaving === 'Leaving') return true;
  if (v.isLeaving === 'Staying') return false;
  return typeof v.timeOut === 'string' && v.timeOut.trim().length > 0;
}

/**
 * EPE duration for one calendar day: earliest time-in through final clock-out.
 * Handoff visits marked Staying are not counted separately — only the day span matters.
 */
export function epeDaySpanMinutes(dayVisits: EpeVisitLike[]): number | null {
  if (!dayVisits.length) return null;

  const sorted = [...dayVisits].sort(
    (a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime(),
  );

  const firstTimeIn = sorted[0]?.timeIn;
  if (firstTimeIn == null || firstTimeIn === '') return null;

  let lastTimeOut: unknown = null;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const v = sorted[i];
    if (isVisitClockedOut(v) && v.timeOut) {
      lastTimeOut = v.timeOut;
      break;
    }
  }
  if (lastTimeOut == null || lastTimeOut === '') return null;

  return epeVisitDurationMinutes(firstTimeIn, lastTimeOut);
}

/** Total EPE minutes across visit log — per-day spans summed (not per-segment). */
export function epeVisitsTotalMinutes(visits: EpeVisitLike[] | undefined): number | null {
  if (!Array.isArray(visits) || visits.length === 0) return null;

  const byDay = new Map<string, EpeVisitLike[]>();
  const undated: EpeVisitLike[] = [];

  for (const v of visits) {
    const day = visitDayKey(v.date);
    if (!day) {
      undated.push(v);
      continue;
    }
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(v);
  }

  let total = 0;
  let counted = false;

  for (const dayVisits of byDay.values()) {
    const mins = epeDaySpanMinutes(dayVisits);
    if (mins !== null) {
      total += mins;
      counted = true;
    }
  }

  for (const v of undated) {
    const mins = epeVisitDurationMinutes(v.timeIn, v.timeOut);
    if (mins !== null) {
      total += mins;
      counted = true;
    }
  }

  return counted ? total : null;
}

/** Total EPE-rounded intake minutes across all visits on a student document. */
export function epeStudentTotalMinutes(doc: {
  timeIn?: unknown;
  timeOut?: unknown;
  intakeVisits?: EpeVisitLike[];
}): number | null {
  if (Array.isArray(doc?.intakeVisits) && doc.intakeVisits.length) {
    return epeVisitsTotalMinutes(doc.intakeVisits);
  }
  return epeVisitDurationMinutes(doc?.timeIn, doc?.timeOut);
}

/** Format an HH:MM string using EPE-rounded time in friendly 12h form. */
export function fmtEpeTimeStr(t?: string): string {
  if (!t) return '—';
  const rounded = roundEpeTime(t);
  if (rounded === null) return t;
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

/** True when the raw clock time differs from its EPE-rounded value. */
export function isEpeAdjusted(t?: string): boolean {
  const raw = parseMinutesOfDay(t);
  const rounded = roundEpeTime(t);
  return raw !== null && rounded !== null && raw !== rounded;
}
