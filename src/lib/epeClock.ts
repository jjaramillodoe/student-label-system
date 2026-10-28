/**
 * EPE Clock — half-hour rounding for intake attendance.
 *
 * - :00–:14 → round down to :00
 * - :15–:44 → round to :30
 * - :45–:59 → round up to next hour :00
 */

import { visitDayKey } from '@/lib/intakeCalendar';

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
  if (v.isLeaving === 'Staying') return false;
  if (v.isLeaving === 'Leaving') {
    return typeof v.timeOut === 'string' && v.timeOut.trim().length > 0;
  }
  return typeof v.timeOut === 'string' && v.timeOut.trim().length > 0;
}

/**
 * EPE duration for one calendar day.
 * Completed cycles (Intake → Left, then Returning Intake → Left) are summed separately.
 * A same-day staff handoff (Staying visits, then a final Time Out) still counts as one span.
 */
export function epeDaySpanMinutes(dayVisits: EpeVisitLike[]): number | null {
  if (!dayVisits.length) return null;

  const sorted = [...dayVisits].sort((a, b) => {
    const aIn = parseMinutesOfDay(a.timeIn);
    const bIn = parseMinutesOfDay(b.timeIn);
    if (aIn !== null && bIn !== null && aIn !== bIn) return aIn - bIn;
    return new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime();
  });

  let total = 0;
  let counted = false;
  let cycleStartIn: unknown = null;

  const flushCycle = (timeOut: unknown) => {
    if (cycleStartIn == null || cycleStartIn === '') return;
    const mins = epeVisitDurationMinutes(cycleStartIn, timeOut);
    if (mins !== null) {
      total += mins;
      counted = true;
    }
    cycleStartIn = null;
  };

  for (const v of sorted) {
    if (cycleStartIn == null) cycleStartIn = v.timeIn;
    if (isVisitClockedOut(v) && v.timeOut) {
      flushCycle(v.timeOut);
    }
  }

  return counted ? total : null;
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

/** One visit row's share of the day: its own time in until the next activity (or its time out). */
export type EpeVisitSegment = {
  minutes: number | null;
  /** Time the segment ends: own time out, or the next visit's time in for a handoff. */
  endTime: unknown;
  /** Handoff row whose end comes from the next visit's time in. */
  handoff: boolean;
  /** Last row of a stay with no time out yet. */
  open: boolean;
};

export type EpeStay = {
  startTime: unknown;
  endTime: unknown | null;
  minutes: number | null;
  open: boolean;
};

export type EpeDayBreakdown = {
  dayKey: string;
  /** Indexes into the original visits array, in clock order. */
  visitIndexes: number[];
  stays: EpeStay[];
  /** Same value as epeDaySpanMinutes for these visits. */
  totalMinutes: number | null;
};

export type EpeVisitBreakdown = {
  /** Keyed by index into the original visits array. */
  segments: EpeVisitSegment[];
  days: EpeDayBreakdown[];
};

/**
 * Split each day's EPE span into per-visit segments so the rows add up to the day total.
 * Mirrors epeDaySpanMinutes: a Staying (or not-yet-clocked-out) visit runs until the next
 * visit's time in; a clocked-out visit closes the stay at its own time out.
 */
export function epeVisitBreakdown(visits: EpeVisitLike[]): EpeVisitBreakdown {
  const segments: EpeVisitSegment[] = visits.map((v) => ({
    minutes: epeVisitDurationMinutes(v.timeIn, v.timeOut),
    endTime: v.timeOut ?? null,
    handoff: false,
    open: false,
  }));

  const byDay = new Map<string, number[]>();
  visits.forEach((v, i) => {
    const day = visitDayKey(v.date);
    if (!day) return;
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(i);
  });

  const days: EpeDayBreakdown[] = [];
  for (const [dayKey, indexes] of byDay) {
    const sorted = [...indexes].sort((ia, ib) => {
      const a = visits[ia];
      const b = visits[ib];
      const aIn = parseMinutesOfDay(a.timeIn);
      const bIn = parseMinutesOfDay(b.timeIn);
      if (aIn !== null && bIn !== null && aIn !== bIn) return aIn - bIn;
      return new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime();
    });

    const stays: EpeStay[] = [];
    let stayStart: unknown = null;
    sorted.forEach((idx, pos) => {
      const v = visits[idx];
      if (stayStart == null) stayStart = v.timeIn;
      if (isVisitClockedOut(v) && v.timeOut) {
        segments[idx] = {
          minutes: epeVisitDurationMinutes(v.timeIn, v.timeOut),
          endTime: v.timeOut,
          handoff: false,
          open: false,
        };
        if (stayStart != null && stayStart !== '') {
          stays.push({
            startTime: stayStart,
            endTime: v.timeOut,
            minutes: epeVisitDurationMinutes(stayStart, v.timeOut),
            open: false,
          });
        }
        stayStart = null;
        return;
      }
      const next = pos + 1 < sorted.length ? visits[sorted[pos + 1]] : null;
      segments[idx] = next
        ? {
            minutes: epeVisitDurationMinutes(v.timeIn, next.timeIn),
            endTime: next.timeIn,
            handoff: true,
            open: false,
          }
        : { minutes: null, endTime: null, handoff: false, open: true };
    });
    if (stayStart != null && stayStart !== '') {
      stays.push({ startTime: stayStart, endTime: null, minutes: null, open: true });
    }

    const completed = stays.filter((s) => !s.open && s.minutes !== null);
    days.push({
      dayKey,
      visitIndexes: sorted,
      stays,
      totalMinutes: completed.length
        ? completed.reduce((sum, s) => sum + (s.minutes ?? 0), 0)
        : null,
    });
  }

  return { segments, days };
}
