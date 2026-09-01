import type { IntakeSession } from '@/lib/intakeSession';
import {
  findIntakeSession,
  formatSessionTimeRange,
  formatTime12,
  isTimeInSessionWindow,
} from '@/lib/intakeSession';
import { parseMinutesOfDay } from '@/lib/epeClock';
import {
  formatDayLabel,
  nowMinutesOfDay,
  todayDayKey,
  visitDayKey,
} from '@/lib/intakeCalendar';

export { formatDayLabel, visitDayKey } from '@/lib/intakeCalendar';

/** Activity label used when staff add a next-day catch-up clock-out. */
export const CATCH_UP_ACTIVITY = 'Intake completion / Clock out';

export type IntakeVisitFlagType =
  | 'premature_clock_out'
  | 'missing_final_clock_out'
  | 'outside_session_window'
  | 'overlapping_times';

export interface IntakeVisitLike {
  date?: string;
  timeIn?: string;
  timeOut?: string | null;
  isLeaving?: string;
  intakeSession?: string;
  intakeActivity?: string[];
  educationStatus?: string;
  placementClass?: string;
  notes?: string;
  recordedBy?: { name?: string; email?: string };
}

export interface IntakeVisitFlag {
  type: IntakeVisitFlagType;
  message: string;
  visitIndex: number;
  dayKey: string;
}

export interface IntakeDayIssue {
  dayKey: string;
  dayLabel: string;
  prematureCount: number;
  missingFinalClockOut: boolean;
  outsideSessionCount: number;
  overlappingCount: number;
  messages: string[];
}

export interface IntakeVisitValidationOptions {
  /** School intake session configs — enables outside-session-window flags. */
  sessionConfigs?: IntakeSession[];
  /** Clock used for session/day-end detection. Defaults to now. */
  now?: Date;
}

export interface IntakeVisitValidation {
  flags: IntakeVisitFlag[];
  hasIssues: boolean;
  flaggedVisitIndices: number[];
  dayIssues: IntakeDayIssue[];
}

export function hasTimeOut(v: IntakeVisitLike): boolean {
  return typeof v.timeOut === 'string' && v.timeOut.trim().length > 0;
}

/** True when the visit completed a departure (Leaving + Time Out, or Time Out without Staying). */
export function isClockedOut(v: IntakeVisitLike): boolean {
  if (v.isLeaving === 'Staying') return false;
  if (v.isLeaving === 'Leaving') return hasTimeOut(v);
  return hasTimeOut(v);
}

export function isCatchUpClose(v: IntakeVisitLike): boolean {
  return Boolean(
    isClockedOut(v)
    && v.intakeActivity?.some((a) => a === CATCH_UP_ACTIVITY),
  );
}

function sortDayEntries(
  dayVisits: Array<{ visit: IntakeVisitLike; index: number }>,
): Array<{ visit: IntakeVisitLike; index: number }> {
  return [...dayVisits].sort((a, b) => {
    const aIn = parseMinutesOfDay(a.visit.timeIn);
    const bIn = parseMinutesOfDay(b.visit.timeIn);
    if (aIn !== null && bIn !== null && aIn !== bIn) return aIn - bIn;
    return new Date(a.visit.date || 0).getTime() - new Date(b.visit.date || 0).getTime();
  });
}

export function sessionHasEndedForVisit(
  visit: IntakeVisitLike,
  options?: IntakeVisitValidationOptions,
): boolean {
  const now = options?.now ?? new Date();
  const day = visitDayKey(visit.date);
  if (!day) return false;
  const today = todayDayKey(now);
  if (day < today) return true;
  if (day > today) return false;

  const session = findIntakeSession(options?.sessionConfigs ?? [], visit.intakeSession);
  const end = session ? parseMinutesOfDay(session.endTime) : 16 * 60;
  if (end === null) return nowMinutesOfDay(now) > 16 * 60;
  return nowMinutesOfDay(now) > end;
}

function hasLaterCatchUpClose(
  visits: IntakeVisitLike[],
  afterTime: number,
): boolean {
  return visits.some((visit) => {
    const t = new Date(visit.date || 0).getTime();
    return !Number.isNaN(t) && t > afterTime && isCatchUpClose(visit);
  });
}

export function validateIntakeVisits(
  visits: IntakeVisitLike[],
  options?: IntakeVisitValidationOptions,
): IntakeVisitValidation {
  const flags: IntakeVisitFlag[] = [];
  const byDay = new Map<string, Array<{ visit: IntakeVisitLike; index: number }>>();

  visits.forEach((visit, index) => {
    const day = visitDayKey(visit.date);
    if (!day) return;
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push({ visit, index });
  });

  for (const [dayKey, dayVisits] of byDay) {
    const sorted = sortDayEntries(dayVisits);

    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];
      if (!isClockedOut(current.visit)) continue;
      const out = parseMinutesOfDay(current.visit.timeOut);
      const nextIn = parseMinutesOfDay(next.visit.timeIn);
      if (out === null || nextIn === null) continue;
      if (nextIn >= out) continue;

      const message =
        `Times overlap on ${formatDayLabel(dayKey)}: the later visit starts at `
        + `${formatTime12(next.visit.timeIn || '')} but the earlier visit’s Time Out is `
        + `${formatTime12(current.visit.timeOut || '')}. Set Time Out before the next Time In `
        + `(or treat the earlier visit as a handoff with Staying).`;
      flags.push({
        type: 'overlapping_times',
        message,
        visitIndex: current.index,
        dayKey,
      });
      flags.push({
        type: 'overlapping_times',
        message,
        visitIndex: next.index,
        dayKey,
      });
    }

    const last = sorted[sorted.length - 1];
    if (last && !isClockedOut(last.visit)) {
      const lastTimeOnDay = Math.max(
        ...sorted.map(({ visit }) => new Date(visit.date || 0).getTime()),
        0,
      );
      const catchUpCloses = hasLaterCatchUpClose(visits, lastTimeOnDay);
      if (!catchUpCloses && sessionHasEndedForVisit(last.visit, options)) {
        const session = findIntakeSession(options?.sessionConfigs ?? [], last.visit.intakeSession);
        const windowHint = session
          ? ` The ${session.name} window ended at ${formatSessionTimeRange(session).split('–')[1]?.trim() || session.endTime}.`
          : '';
        const message =
          'Missing Time Out — this check-in is still open after the session ended. '
          + 'Set Time Out when the student left, or add a catch-up visit if staff forgot to clock out.'
          + windowHint;
        flags.push({
          type: 'missing_final_clock_out',
          message,
          visitIndex: last.index,
          dayKey,
        });
      }
    }
  }

  const sessionConfigs = options?.sessionConfigs;
  if (sessionConfigs?.length) {
    visits.forEach((visit, index) => {
      const session = findIntakeSession(sessionConfigs, visit.intakeSession);
      if (!session?.name) return;

      const dayKey = visitDayKey(visit.date) || 'unknown';

      if (visit.timeIn && !isTimeInSessionWindow(visit.timeIn, session)) {
        flags.push({
          type: 'outside_session_window',
          message:
            `Time In (${formatTime12(visit.timeIn)}) is outside the ${session.name} window `
            + `(${formatSessionTimeRange(session)}).`,
          visitIndex: index,
          dayKey,
        });
      }

      if (visit.timeOut && !isTimeInSessionWindow(visit.timeOut, session)) {
        flags.push({
          type: 'outside_session_window',
          message:
            `Time Out (${formatTime12(visit.timeOut)}) is outside the ${session.name} window `
            + `(${formatSessionTimeRange(session)}).`,
          visitIndex: index,
          dayKey,
        });
      }
    });
  }

  const dayIssueMap = new Map<string, IntakeDayIssue>();
  for (const flag of flags) {
    if (!dayIssueMap.has(flag.dayKey)) {
      dayIssueMap.set(flag.dayKey, {
        dayKey: flag.dayKey,
        dayLabel: formatDayLabel(flag.dayKey),
        prematureCount: 0,
        missingFinalClockOut: false,
        outsideSessionCount: 0,
        overlappingCount: 0,
        messages: [],
      });
    }
    const issue = dayIssueMap.get(flag.dayKey)!;
    if (flag.type === 'premature_clock_out') issue.prematureCount += 1;
    if (flag.type === 'missing_final_clock_out') issue.missingFinalClockOut = true;
    if (flag.type === 'outside_session_window') issue.outsideSessionCount += 1;
    if (flag.type === 'overlapping_times' && !issue.messages.includes(flag.message)) {
      issue.overlappingCount += 1;
    }
    if (!issue.messages.includes(flag.message)) issue.messages.push(flag.message);
  }

  const uniqueFlags: IntakeVisitFlag[] = [];
  const seen = new Set<string>();
  for (const flag of flags) {
    const key = `${flag.type}:${flag.visitIndex}:${flag.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueFlags.push(flag);
  }

  const flaggedVisitIndices = [...new Set(uniqueFlags.map((f) => f.visitIndex))];

  return {
    flags: uniqueFlags,
    hasIssues: uniqueFlags.length > 0,
    flaggedVisitIndices,
    dayIssues: [...dayIssueMap.values()].sort((a, b) => a.dayKey.localeCompare(b.dayKey)),
  };
}

export function flagsForVisit(
  validation: IntakeVisitValidation,
  visitIndex: number,
): IntakeVisitFlag[] {
  return validation.flags.filter((f) => f.visitIndex === visitIndex);
}

export const INTAKE_FLAG_LABELS: Record<IntakeVisitFlagType, string> = {
  premature_clock_out: 'Early Time Out',
  missing_final_clock_out: 'Missing Time-Out',
  outside_session_window: 'Outside Session Hours',
  overlapping_times: 'Overlapping times',
};

const FLAG_PRIORITY: IntakeVisitFlagType[] = [
  'missing_final_clock_out',
  'overlapping_times',
  'outside_session_window',
  'premature_clock_out',
];

/** Most urgent label for enrollment table badges. */
export function primaryIntakeIssueLabel(flags: IntakeVisitFlag[]): string {
  for (const type of FLAG_PRIORITY) {
    if (flags.some((f) => f.type === type)) return INTAKE_FLAG_LABELS[type];
  }
  return 'Intake issue';
}
