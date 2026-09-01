import { describe, expect, it } from 'vitest';
import { DEFAULT_INTAKE_SESSION_CONFIGS } from './intakeSession';
import {
  buildIntakeFixPreview,
  listEarlierOpenVisits,
  suggestDefaultTimeOut,
} from './intakeVisitFix';
import type { IntakeVisitLike } from './intakeVisitValidation';

const MORNING = DEFAULT_INTAKE_SESSION_CONFIGS.find(s => s.name === 'MORNING 8am-4pm')!;
const afterMorning = new Date('2026-09-01T16:30:00-04:00');

const openHandoffs: IntakeVisitLike[] = [
  {
    date: '2026-09-01T08:17:00-04:00',
    timeIn: '08:30',
    isLeaving: 'Staying',
    intakeSession: MORNING.name,
    intakeActivity: ['Placement'],
  },
  {
    date: '2026-09-01T08:19:00-04:00',
    timeIn: '12:30',
    isLeaving: 'Staying',
    intakeSession: MORNING.name,
    intakeActivity: ['Testing'],
  },
];

describe('buildIntakeFixPreview', () => {
  it('does not strip a valid Leaving Time Out when a later same-day visit exists', () => {
    const visits: IntakeVisitLike[] = [
      {
        date: '2026-09-01T08:17:00-04:00',
        timeIn: '08:30',
        timeOut: '11:00',
        isLeaving: 'Leaving',
        intakeSession: MORNING.name,
      },
      {
        date: '2026-09-01T12:10:00-04:00',
        timeIn: '12:30',
        timeOut: '15:00',
        isLeaving: 'Leaving',
        intakeSession: MORNING.name,
      },
    ];
    const preview = buildIntakeFixPreview(visits, [], [], undefined, [], {
      sessionConfigs: [MORNING],
      now: afterMorning,
    });
    expect(preview.visits[0].isLeaving).toBe('Leaving');
    expect(preview.visits[0].timeOut).toBe('11:00');
    expect(preview.stillNeedsFinalClockOut).toEqual([]);
  });

  it('sets Time Out on the last visit of the day', () => {
    const preview = buildIntakeFixPreview(
      openHandoffs,
      [{ dayKey: '2026-09-01', timeOut: '15:00' }],
      [],
      undefined,
      [],
      { sessionConfigs: [MORNING], now: afterMorning },
    );
    expect(preview.visits[1].isLeaving).toBe('Leaving');
    expect(preview.visits[1].timeOut).toBe('15:00');
    expect(preview.visits[0].isLeaving).toBe('Staying');
    expect(preview.stillNeedsFinalClockOut).toEqual([]);
  });

  it('Dismiss & Re-admit clocks out earlier open visits without clearing the later visit', () => {
    const preview = buildIntakeFixPreview(
      openHandoffs,
      [],
      [],
      undefined,
      [{ visitIndex: 0, timeOut: '12:29' }],
      { sessionConfigs: [MORNING], now: afterMorning },
    );
    expect(preview.visits[0].isLeaving).toBe('Leaving');
    expect(preview.visits[0].timeOut).toBe('12:29');
    expect(preview.visits[1].isLeaving).toBe('Staying');
    expect(preview.stillNeedsFinalClockOut).toHaveLength(1);
  });
});

describe('suggestDefaultTimeOut / listEarlierOpenVisits', () => {
  it('suggests one minute before the next Time In', () => {
    expect(suggestDefaultTimeOut({
      visit: openHandoffs[0],
      nextVisit: openHandoffs[1],
      session: MORNING,
      now: afterMorning,
    })).toBe('12:29');
  });

  it('suggests session end after the window closes', () => {
    expect(suggestDefaultTimeOut({
      visit: openHandoffs[1],
      session: MORNING,
      now: afterMorning,
    })).toBe('16:00');
  });

  it('lists earlier open visits for Dismiss & Re-admit', () => {
    const earlier = listEarlierOpenVisits(openHandoffs, { sessionConfigs: [MORNING] });
    expect(earlier).toHaveLength(1);
    expect(earlier[0].visitIndex).toBe(0);
    expect(earlier[0].suggestedTimeOut).toBe('12:29');
  });
});
