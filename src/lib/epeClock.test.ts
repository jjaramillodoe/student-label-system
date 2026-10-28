import { describe, expect, it } from 'vitest';
import { epeDaySpanMinutes, epeVisitBreakdown, epeVisitsTotalMinutes } from './epeClock';

// Gomez Marco example: one stay on Aug 28, one stay with two handoffs on Sep 1.
const visits = [
  { date: '2026-08-28T16:49:00.000Z', timeIn: '12:30', timeOut: '16:00', isLeaving: 'Leaving' },
  { date: '2026-09-01T12:17:00.000Z', timeIn: '08:30', timeOut: null, isLeaving: 'Staying' },
  { date: '2026-09-01T12:19:00.000Z', timeIn: '12:30', timeOut: null, isLeaving: 'Staying' },
  { date: '2026-09-01T12:49:00.000Z', timeIn: '14:00', timeOut: '15:00', isLeaving: 'Leaving' },
];

describe('epeVisitBreakdown', () => {
  it('gives handoff rows the time until the next visit', () => {
    const { segments } = epeVisitBreakdown(visits);
    expect(segments.map((s) => s.minutes)).toEqual([210, 240, 90, 60]);
    expect(segments[1]).toMatchObject({ handoff: true, endTime: '12:30' });
    expect(segments[3]).toMatchObject({ handoff: false, endTime: '15:00' });
  });

  it('day totals match the EPE clock and rows add up to them', () => {
    const { segments, days } = epeVisitBreakdown(visits);
    expect(days.map((d) => d.totalMinutes)).toEqual([210, 390]);
    for (const day of days) {
      const rowSum = day.visitIndexes.reduce((sum, i) => sum + (segments[i].minutes ?? 0), 0);
      expect(rowSum).toBe(day.totalMinutes);
      expect(day.totalMinutes).toBe(epeDaySpanMinutes(day.visitIndexes.map((i) => visits[i])));
    }
    expect(days.reduce((sum, d) => sum + (d.totalMinutes ?? 0), 0)).toBe(epeVisitsTotalMinutes(visits));
  });

  it('counts a leave-and-return day as two stays', () => {
    const { days } = epeVisitBreakdown([
      { date: '2026-09-02T13:00:00.000Z', timeIn: '09:00', timeOut: '11:00', isLeaving: 'Leaving' },
      { date: '2026-09-02T18:00:00.000Z', timeIn: '14:00', timeOut: '15:30', isLeaving: 'Leaving' },
    ]);
    expect(days[0].stays.map((s) => s.minutes)).toEqual([120, 90]);
    expect(days[0].totalMinutes).toBe(210);
  });

  it('marks the last Staying row of a day as open when no time out was recorded', () => {
    const { segments, days } = epeVisitBreakdown([
      { date: '2026-09-03T13:00:00.000Z', timeIn: '09:00', timeOut: null, isLeaving: 'Staying' },
      { date: '2026-09-03T15:00:00.000Z', timeIn: '11:00', timeOut: null, isLeaving: 'Staying' },
    ]);
    expect(segments.map((s) => s.minutes)).toEqual([120, null]);
    expect(segments[1].open).toBe(true);
    expect(days[0].stays).toEqual([{ startTime: '09:00', endTime: null, minutes: null, open: true }]);
    expect(days[0].totalMinutes).toBeNull();
  });
});
