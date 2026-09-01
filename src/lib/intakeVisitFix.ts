import { parseMinutesOfDay } from '@/lib/epeClock';
import { formatMinutesOfDay, nowMinutesOfDay, todayDayKey, visitDayKey } from '@/lib/intakeCalendar';
import { findIntakeSession, type IntakeSession } from '@/lib/intakeSession';
import {
  CATCH_UP_ACTIVITY,
  formatDayLabel,
  isClockedOut,
  validateIntakeVisits,
  type IntakeVisitLike,
  type IntakeVisitValidationOptions,
} from '@/lib/intakeVisitValidation';

export const INTAKE_FIX_ROLES = [
  'Admin',
  'Data Lead',
  'Data Member',
  'Intake Member',
] as const;

export function canFixIntakeHandoff(role?: string | null): boolean {
  return INTAKE_FIX_ROLES.includes(role as (typeof INTAKE_FIX_ROLES)[number]);
}

export interface FinalClockOutInput {
  dayKey: string;
  timeOut: string;
}

export interface ClosingVisitInput {
  /** Open intake day this catch-up visit closes (YYYY-MM-DD). */
  forDayKey: string;
  visitDate: string;
  timeIn: string;
  timeOut: string;
  intakeActivity?: string[];
}

/** Clock out a specific visit (Dismiss & Re-admit / earlier cycle). */
export interface ClockOutVisitInput {
  visitIndex: number;
  timeOut: string;
}

export function combineDateAndTime(visitDate: string, time: string): string {
  const [h, m] = time.split(':').map(v => parseInt(v, 10));
  const d = new Date(`${visitDate}T00:00:00`);
  if (!Number.isNaN(h) && !Number.isNaN(m)) {
    d.setHours(h, m, 0, 0);
  }
  return d.toISOString();
}

/** First calendar day after a YYYY-MM-DD key (for date picker min). */
export function dayAfter(dayKey: string): string {
  const d = new Date(`${dayKey}T12:00:00`);
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface IntakeFixPreview {
  changes: string[];
  visits: IntakeVisitLike[];
  stillNeedsFinalClockOut: Array<{ dayKey: string; dayLabel: string; visitIndex: number }>;
}

export interface EarlierOpenVisit {
  visitIndex: number;
  dayKey: string;
  dayLabel: string;
  activity?: string;
  timeIn?: string;
  suggestedTimeOut: string;
}

function cloneVisits(visits: IntakeVisitLike[]): IntakeVisitLike[] {
  return visits.map(v => ({ ...v }));
}

function compareVisitsOnDay(a: IntakeVisitLike, b: IntakeVisitLike): number {
  const aIn = parseMinutesOfDay(a.timeIn);
  const bIn = parseMinutesOfDay(b.timeIn);
  if (aIn !== null && bIn !== null && aIn !== bIn) return aIn - bIn;
  return new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime();
}

export function getLastVisitIndexForDay(visits: IntakeVisitLike[], dayKey: string): number | null {
  const entries = visits
    .map((visit, index) => ({ visit, index }))
    .filter(({ visit }) => visitDayKey(visit.date) === dayKey);
  if (!entries.length) return null;
  const sorted = [...entries].sort((a, b) => compareVisitsOnDay(a.visit, b.visit));
  return sorted[sorted.length - 1].index;
}

/**
 * Default Time Out: one minute before the next same-day Time In,
 * otherwise "now" if still in session today, otherwise the session end.
 */
export function suggestDefaultTimeOut(params: {
  visit: IntakeVisitLike;
  nextVisit?: IntakeVisitLike | null;
  session?: IntakeSession | null;
  now?: Date;
}): string {
  const thisIn = parseMinutesOfDay(params.visit.timeIn);
  const nextIn = params.nextVisit ? parseMinutesOfDay(params.nextVisit.timeIn) : null;
  if (nextIn !== null) {
    const out = Math.max(thisIn ?? 0, nextIn - 1);
    return formatMinutesOfDay(out);
  }

  const sessionEnd = params.session ? parseMinutesOfDay(params.session.endTime) : null;
  const now = params.now ?? new Date();
  const visitDay = visitDayKey(params.visit.date);
  const today = todayDayKey(now);
  const nowMins = nowMinutesOfDay(now);

  if (
    visitDay === today
    && (thisIn === null || nowMins >= thisIn)
    && (sessionEnd === null || nowMins <= sessionEnd)
  ) {
    return formatMinutesOfDay(nowMins);
  }

  if (sessionEnd !== null && (thisIn === null || sessionEnd >= thisIn)) {
    return params.session!.endTime;
  }

  return formatMinutesOfDay(Math.min((thisIn ?? 0) + 30, 23 * 60 + 59));
}

/** Open visits that are not the last activity of their day — candidates for Dismiss & Re-admit. */
export function listEarlierOpenVisits(
  visits: IntakeVisitLike[],
  options?: { now?: Date; sessionConfigs?: IntakeSession[] },
): EarlierOpenVisit[] {
  const byDay = new Map<string, Array<{ visit: IntakeVisitLike; index: number }>>();
  visits.forEach((visit, index) => {
    const day = visitDayKey(visit.date);
    if (!day) return;
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push({ visit, index });
  });

  const result: EarlierOpenVisit[] = [];
  for (const [dayKey, dayVisits] of byDay) {
    const sorted = [...dayVisits].sort((a, b) => compareVisitsOnDay(a.visit, b.visit));
    if (sorted.length < 2) continue;
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      if (isClockedOut(current.visit)) continue;
      const next = sorted[i + 1];
      const session = findIntakeSession(options?.sessionConfigs ?? [], current.visit.intakeSession);
      result.push({
        visitIndex: current.index,
        dayKey,
        dayLabel: formatDayLabel(dayKey),
        activity: current.visit.intakeActivity?.join(', '),
        timeIn: current.visit.timeIn,
        suggestedTimeOut: suggestDefaultTimeOut({
          visit: current.visit,
          nextVisit: next.visit,
          session,
          now: options?.now,
        }),
      });
    }
  }
  return result;
}

/** Set Time Out / catch-up visits. Does not convert valid Leaving records to Staying. */
export function buildIntakeFixPreview(
  visits: IntakeVisitLike[],
  finalClockOuts: FinalClockOutInput[] = [],
  closingVisits: ClosingVisitInput[] = [],
  recordedBy?: { name?: string; email?: string },
  extraClockOuts: ClockOutVisitInput[] = [],
  options?: IntakeVisitValidationOptions,
): IntakeFixPreview {
  const changes: string[] = [];
  let updated = cloneVisits(visits);

  for (const extra of extraClockOuts) {
    const visit = updated[extra.visitIndex];
    if (!visit || !extra.timeOut.trim()) continue;
    updated[extra.visitIndex] = {
      ...visit,
      isLeaving: 'Leaving',
      timeOut: extra.timeOut.trim(),
    };
    changes.push(
      `Visit #${extra.visitIndex + 1} (${formatDayLabel(visitDayKey(visit.date) || '')}): `
      + `set Time Out to ${extra.timeOut.trim()} so a later visit can be a returning intake.`,
    );
  }

  for (const closing of closingVisits) {
    if (!closing.visitDate.trim() || !closing.timeIn.trim() || !closing.timeOut.trim()) continue;
    const activity = closing.intakeActivity?.length
      ? closing.intakeActivity
      : [CATCH_UP_ACTIVITY];
    updated.push({
      date: combineDateAndTime(closing.visitDate, closing.timeIn),
      timeIn: closing.timeIn.trim(),
      timeOut: closing.timeOut.trim(),
      isLeaving: 'Leaving',
      intakeActivity: activity,
      recordedBy,
    });
    changes.push(
      `Added catch-up activity on ${formatDayLabel(closing.visitDate)} `
      + `(${closing.timeIn} → ${closing.timeOut}) to close open intake from ${formatDayLabel(closing.forDayKey)}.`,
    );
  }

  updated = [...updated].sort(
    (a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime(),
  );

  for (const entry of finalClockOuts) {
    const idx = getLastVisitIndexForDay(updated, entry.dayKey);
    if (idx === null || !entry.timeOut.trim()) continue;
    const visit = updated[idx];
    updated[idx] = {
      ...visit,
      isLeaving: 'Leaving',
      timeOut: entry.timeOut.trim(),
    };
    changes.push(
      `Visit #${idx + 1} (${formatDayLabel(entry.dayKey)}): `
      + `set Time Out to ${entry.timeOut.trim()} (EPE).`,
    );
  }

  const after = validateIntakeVisits(updated, options);
  const stillNeedsFinalClockOut = after.dayIssues
    .filter(d => d.missingFinalClockOut)
    .map(d => ({
      dayKey: d.dayKey,
      dayLabel: d.dayLabel,
      visitIndex: getLastVisitIndexForDay(updated, d.dayKey) ?? -1,
    }))
    .filter(d => d.visitIndex >= 0);

  return { changes, visits: updated, stillNeedsFinalClockOut };
}

/** Sync top-level intake fields from the most recent visit. */
export function syncTopLevelIntakeFields(
  visits: Array<IntakeVisitLike & { intakeSession?: string; intakeActivity?: string[] }>,
): Record<string, unknown> {
  if (!visits.length) {
    return {
      timeIn: null,
      timeOut: null,
      isLeaving: null,
    };
  }
  const latest = [...visits].sort(
    (a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime(),
  )[0];
  return {
    timeIn: latest.timeIn ?? null,
    timeOut: latest.timeOut ?? null,
    isLeaving: latest.isLeaving ?? null,
    intakeSession: latest.intakeSession ?? undefined,
    intakeActivity: latest.intakeActivity ?? undefined,
  };
}
