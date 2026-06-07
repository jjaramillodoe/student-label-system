import {
  validateIntakeVisits,
  visitDayKey,
  formatDayLabel,
  type IntakeVisitLike,
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

function cloneVisits(visits: IntakeVisitLike[]): IntakeVisitLike[] {
  return visits.map(v => ({ ...v }));
}

export function getLastVisitIndexForDay(visits: IntakeVisitLike[], dayKey: string): number | null {
  let lastIndex: number | null = null;
  let lastTime = -1;
  visits.forEach((visit, index) => {
    if (visitDayKey(visit.date) !== dayKey) return;
    const t = new Date(visit.date || 0).getTime();
    if (!Number.isNaN(t) && t >= lastTime) {
      lastTime = t;
      lastIndex = index;
    }
  });
  return lastIndex;
}

/** Clear early Time Out on handoff visits; set same-day clock-out or append catch-up visits. */
export function buildIntakeFixPreview(
  visits: IntakeVisitLike[],
  finalClockOuts: FinalClockOutInput[] = [],
  closingVisits: ClosingVisitInput[] = [],
  recordedBy?: { name?: string; email?: string },
): IntakeFixPreview {
  const changes: string[] = [];
  let updated = cloneVisits(visits);

  for (const closing of closingVisits) {
    if (!closing.visitDate.trim() || !closing.timeIn.trim() || !closing.timeOut.trim()) continue;
    const activity = closing.intakeActivity?.length
      ? closing.intakeActivity
      : ['Intake completion / Clock out'];
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

  const validation = validateIntakeVisits(updated);

  for (const flag of validation.flags) {
    if (flag.type !== 'premature_clock_out') continue;
    const visit = updated[flag.visitIndex];
    if (!visit) continue;
    updated[flag.visitIndex] = {
      ...visit,
      isLeaving: 'Staying',
      timeOut: null,
    };
    changes.push(
      `Visit #${flag.visitIndex + 1} (${formatDayLabel(flag.dayKey)}): `
      + 'changed to Staying and removed Time Out (handoff activity).',
    );
  }

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
      + `set final Time Out to ${entry.timeOut.trim()} (EPE).`,
    );
  }

  const after = validateIntakeVisits(updated);
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
