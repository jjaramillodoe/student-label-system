import { describe, expect, it } from 'vitest';
import { epeDaySpanMinutes, epeVisitsTotalMinutes } from './epeClock';
import { todayDayKey, visitDayKey } from './intakeCalendar';

describe('intake calendar day keys', () => {
  it('keeps YYYY-MM-DD strings as-is', () => {
    expect(visitDayKey('2026-09-01')).toBe('2026-09-01');
  });

  it('maps ISO timestamps to America/New_York calendar days', () => {
    expect(visitDayKey('2026-09-02T03:00:00.000Z')).toBe('2026-09-01');
    expect(visitDayKey('2026-09-01T12:17:00.000-04:00')).toBe('2026-09-01');
  });

  it('todayDayKey uses the school timezone', () => {
    expect(todayDayKey(new Date('2026-09-02T03:00:00.000Z'))).toBe('2026-09-01');
  });
});

describe('epeDaySpanMinutes cycles', () => {
  it('sums completed leave/return cycles instead of first-in to last-out', () => {
    const mins = epeDaySpanMinutes([
      { date: '2026-09-01T08:00:00-04:00', timeIn: '08:00', timeOut: '11:00', isLeaving: 'Leaving' },
      { date: '2026-09-01T12:30:00-04:00', timeIn: '12:30', timeOut: '15:00', isLeaving: 'Leaving' },
    ]);
    // 08:00–11:00 = 180, 12:30–15:00 = 150; not 08:00–15:00 = 420
    expect(mins).toBe(330);
  });

  it('counts a Staying handoff plus final Time Out as one span', () => {
    const mins = epeDaySpanMinutes([
      { date: '2026-09-01T08:30:00-04:00', timeIn: '08:30', isLeaving: 'Staying' },
      { date: '2026-09-01T10:00:00-04:00', timeIn: '10:00', timeOut: '15:00', isLeaving: 'Leaving' },
    ]);
    expect(mins).toBe(390);
  });

  it('totals cycles across days', () => {
    const total = epeVisitsTotalMinutes([
      { date: '2026-09-01T08:00:00-04:00', timeIn: '08:00', timeOut: '11:00', isLeaving: 'Leaving' },
      { date: '2026-09-02T08:00:00-04:00', timeIn: '08:00', timeOut: '09:00', isLeaving: 'Leaving' },
    ]);
    expect(total).toBe(240);
  });
});
