import { describe, expect, it } from 'vitest';
import { DEFAULT_INTAKE_SESSION_CONFIGS } from './intakeSession';
import {
  CATCH_UP_ACTIVITY,
  INTAKE_FLAG_LABELS,
  primaryIntakeIssueLabel,
  validateIntakeVisits,
  type IntakeVisitLike,
} from './intakeVisitValidation';

const MORNING = 'MORNING 8am-4pm';
const sessions = DEFAULT_INTAKE_SESSION_CONFIGS;
const duringMorning = new Date('2026-09-01T08:29:00-04:00');
const afterMorning = new Date('2026-09-01T16:30:00-04:00');

function visit(partial: IntakeVisitLike): IntakeVisitLike {
  return {
    intakeSession: MORNING,
    ...partial,
  };
}

describe('validateIntakeVisits', () => {
  it('allows a same-day Intake → Left → Returning Intake → Left cycle', () => {
    const result = validateIntakeVisits([
      visit({
        date: '2026-09-01T08:17:00-04:00',
        timeIn: '08:30',
        timeOut: '11:00',
        isLeaving: 'Leaving',
        intakeActivity: ['Orientation'],
      }),
      visit({
        date: '2026-09-01T12:10:00-04:00',
        timeIn: '12:30',
        timeOut: '15:00',
        isLeaving: 'Leaving',
        intakeActivity: ['Testing'],
      }),
    ], { sessionConfigs: sessions, now: afterMorning });

    expect(result.hasIssues).toBe(false);
    expect(result.flags).toEqual([]);
  });

  it('does not flag in-progress same-day handoffs (two Staying visits during the session)', () => {
    const result = validateIntakeVisits([
      visit({
        date: '2026-09-01T08:17:00-04:00',
        timeIn: '08:30',
        isLeaving: 'Staying',
        intakeActivity: ['Placement'],
      }),
      visit({
        date: '2026-09-01T08:19:00-04:00',
        timeIn: '12:30',
        isLeaving: 'Staying',
        intakeActivity: ['Testing'],
      }),
    ], { sessionConfigs: sessions, now: duringMorning });

    expect(result.flags.filter(f => f.type === 'missing_final_clock_out')).toEqual([]);
  });

  it('flags Missing Time-Out on the last open visit after the session ends', () => {
    const result = validateIntakeVisits([
      visit({
        date: '2026-09-01T08:17:00-04:00',
        timeIn: '08:30',
        isLeaving: 'Staying',
        intakeActivity: ['Placement'],
      }),
      visit({
        date: '2026-09-01T08:19:00-04:00',
        timeIn: '12:30',
        isLeaving: 'Staying',
        intakeActivity: ['Testing'],
      }),
    ], { sessionConfigs: sessions, now: afterMorning });

    const missing = result.flags.filter(f => f.type === 'missing_final_clock_out');
    expect(missing).toHaveLength(1);
    expect(missing[0].visitIndex).toBe(1);
    expect(INTAKE_FLAG_LABELS.missing_final_clock_out).toBe('Missing Time-Out');
    expect(primaryIntakeIssueLabel(result.flags)).toBe('Missing Time-Out');
    expect(result.dayIssues[0].missingFinalClockOut).toBe(true);
  });

  it('does not flag a closed handoff chain (Staying then Leaving with Time Out)', () => {
    const result = validateIntakeVisits([
      visit({
        date: '2026-09-01T08:17:00-04:00',
        timeIn: '08:30',
        isLeaving: 'Staying',
      }),
      visit({
        date: '2026-09-01T10:00:00-04:00',
        timeIn: '10:00',
        timeOut: '15:00',
        isLeaving: 'Leaving',
      }),
    ], { sessionConfigs: sessions, now: afterMorning });

    expect(result.flags.filter(f => f.type === 'missing_final_clock_out')).toEqual([]);
    expect(result.flags.filter(f => f.type === 'premature_clock_out')).toEqual([]);
  });

  it('flags overlapping times in plain language', () => {
    const result = validateIntakeVisits([
      visit({
        date: '2026-09-01T08:17:00-04:00',
        timeIn: '08:30',
        timeOut: '12:00',
        isLeaving: 'Leaving',
      }),
      visit({
        date: '2026-09-01T11:00:00-04:00',
        timeIn: '11:30',
        timeOut: '15:00',
        isLeaving: 'Leaving',
      }),
    ], { sessionConfigs: sessions, now: afterMorning });

    const overlap = result.flags.filter(f => f.type === 'overlapping_times');
    expect(overlap.length).toBeGreaterThan(0);
    expect(overlap[0].message).toMatch(/overlap/i);
    expect(overlap[0].message).toMatch(/11:30 AM/);
    expect(overlap[0].message).toMatch(/12:00 PM/);
    expect(result.dayIssues[0].overlappingCount).toBe(1);
  });

  it('does not flag missing Time-Out when a later catch-up clock-out exists', () => {
    const result = validateIntakeVisits([
      visit({
        date: '2026-09-01T08:17:00-04:00',
        timeIn: '08:30',
        isLeaving: 'Staying',
      }),
      visit({
        date: '2026-09-02T09:00:00-04:00',
        timeIn: '09:00',
        timeOut: '09:15',
        isLeaving: 'Leaving',
        intakeActivity: [CATCH_UP_ACTIVITY],
        intakeSession: MORNING,
      }),
    ], { sessionConfigs: sessions, now: new Date('2026-09-02T10:00:00-04:00') });

    expect(result.flags.filter(f => f.type === 'missing_final_clock_out')).toEqual([]);
  });

  it('flags Time In outside the session window', () => {
    const result = validateIntakeVisits([
      visit({
        date: '2026-09-01T18:00:00-04:00',
        timeIn: '18:00',
        timeOut: '18:30',
        isLeaving: 'Leaving',
      }),
    ], { sessionConfigs: sessions, now: afterMorning });

    expect(result.flags.some(f => f.type === 'outside_session_window')).toBe(true);
  });
});
