import { describe, expect, it } from 'vitest';
import { buildEnrollmentInsights, eachDayKey, shortSessionLabel } from './enrollmentInsights';

const monthStart = new Date('2026-09-01T04:00:00.000Z');
const now = new Date('2026-09-01T13:06:00.000Z');

describe('buildEnrollmentInsights', () => {
  it('splits August registrations from September returning visits', () => {
    const insights = buildEnrollmentInsights([
      {
        createdAt: '2026-08-28T16:49:00.000Z',
        educationStatus: 'ESL',
        intakeSession: 'MORNING 8am-4pm',
        intakeVisits: [
          {
            date: '2026-08-28T16:49:00.000Z',
            timeIn: '12:30',
            timeOut: '15:00',
            isLeaving: 'Leaving',
            intakeSession: 'MORNING 8am-4pm',
            educationStatus: 'ESL',
          },
          {
            date: '2026-09-01T12:17:00.000Z',
            timeIn: '08:30',
            isLeaving: 'Staying',
            intakeSession: 'MORNING 8am-4pm',
            educationStatus: 'ESL',
          },
        ],
      },
      {
        createdAt: '2026-09-01T13:00:00.000Z',
        educationStatus: 'BE',
        intakeSession: 'EVENING 4pm-5pm',
        intakeVisits: [{
          date: '2026-09-01T13:00:00.000Z',
          timeIn: '16:15',
          timeOut: '16:45',
          isLeaving: 'Leaving',
          intakeSession: 'EVENING 4pm-5pm',
          educationStatus: 'BE',
        }],
      },
    ], { periodStart: monthStart, trendStart: monthStart, now });

    expect(insights.newFiles).toBe(1);
    expect(insights.visits).toBe(2);
    expect(insights.returningVisits).toBe(1);
    expect(insights.clockedOutVisits).toBe(1);
    expect(insights.openVisits).toBe(1);
    expect(insights.clockOutRate).toBe(50);
    expect(insights.beStudents).toBe(1);
    expect(insights.eslStudents).toBe(1);
    expect(insights.sessionMix.map(s => s.name)).toEqual(['MORNING 8am', 'EVENING 4pm']);
    expect(insights.hourMix.map(h => h.label)).toEqual(['8 AM', '4 PM']);
    const sept1 = insights.daily.find(d => d.date === '2026-09-01');
    expect(sept1).toMatchObject({ newFiles: 1, visits: 2 });
  });

  it('fills every calendar day in the trend window', () => {
    expect(eachDayKey('2026-08-31', '2026-09-01')).toEqual(['2026-08-31', '2026-09-01']);
    expect(shortSessionLabel('MORNING 8am-4pm')).toBe('MORNING 8am');
  });
});
