export type IntakeVisitFlagType =
  | 'premature_clock_out'
  | 'missing_final_clock_out';

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
  messages: string[];
}

export interface IntakeVisitValidation {
  flags: IntakeVisitFlag[];
  hasIssues: boolean;
  flaggedVisitIndices: number[];
  dayIssues: IntakeDayIssue[];
}

function hasTimeOut(v: IntakeVisitLike): boolean {
  return typeof v.timeOut === 'string' && v.timeOut.trim().length > 0;
}

/** Handoff visits should be Staying; only the final visit of the day may be Leaving. */
function isClockedOut(v: IntakeVisitLike): boolean {
  if (v.isLeaving === 'Leaving') return true;
  if (v.isLeaving === 'Staying') return false;
  return hasTimeOut(v);
}

export function visitDayKey(date?: string): string | null {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDayLabel(dayKey: string): string {
  const d = new Date(`${dayKey}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dayKey;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function validateIntakeVisits(visits: IntakeVisitLike[]): IntakeVisitValidation {
  const flags: IntakeVisitFlag[] = [];
  const byDay = new Map<string, Array<{ visit: IntakeVisitLike; index: number }>>();

  visits.forEach((visit, index) => {
    const day = visitDayKey(visit.date);
    if (!day) return;
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push({ visit, index });
  });

  for (const [dayKey, dayVisits] of byDay) {
    if (dayVisits.length < 2) continue;

    const sorted = [...dayVisits].sort(
      (a, b) => new Date(a.visit.date || 0).getTime() - new Date(b.visit.date || 0).getTime(),
    );

    const allStaying = sorted.every(({ visit }) => !isClockedOut(visit));
    const lastTimeOnDay = Math.max(
      ...sorted.map(({ visit }) => new Date(visit.date || 0).getTime()),
      0,
    );
    const hasCatchUpClose = visits.some(visit => {
      const t = new Date(visit.date || 0).getTime();
      return !Number.isNaN(t) && t > lastTimeOnDay && isClockedOut(visit);
    });

    if (allStaying && !hasCatchUpClose) {
      const message =
        'Multiple intake activities on the same day but no Time Out was recorded. '
        + 'The student was handed off between staff — only the final activity should clock the student out when intake is complete.';
      for (const { index } of sorted) {
        flags.push({ type: 'missing_final_clock_out', message, visitIndex: index, dayKey });
      }
    }

    sorted.forEach(({ visit, index }, i) => {
      const isLast = i === sorted.length - 1;
      if (!isLast && isClockedOut(visit)) {
        flags.push({
          type: 'premature_clock_out',
          message:
            'Time Out recorded on a handoff activity. The student was still in intake — '
            + 'only the last staff member of the day should add the Time Out (EPE).',
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
        messages: [],
      });
    }
    const issue = dayIssueMap.get(flag.dayKey)!;
    if (flag.type === 'premature_clock_out') issue.prematureCount += 1;
    if (flag.type === 'missing_final_clock_out') issue.missingFinalClockOut = true;
    if (!issue.messages.includes(flag.message)) issue.messages.push(flag.message);
  }

  const flaggedVisitIndices = [...new Set(flags.map(f => f.visitIndex))];

  return {
    flags,
    hasIssues: flags.length > 0,
    flaggedVisitIndices,
    dayIssues: [...dayIssueMap.values()].sort((a, b) => a.dayKey.localeCompare(b.dayKey)),
  };
}

export function flagsForVisit(
  validation: IntakeVisitValidation,
  visitIndex: number,
): IntakeVisitFlag[] {
  return validation.flags.filter(f => f.visitIndex === visitIndex);
}

export const INTAKE_FLAG_LABELS: Record<IntakeVisitFlagType, string> = {
  premature_clock_out: 'Early Time Out',
  missing_final_clock_out: 'No Final Time Out',
};
