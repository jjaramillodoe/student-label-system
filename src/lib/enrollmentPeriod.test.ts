import { describe, expect, it } from 'vitest';
import {
  enrollmentPeriodMongoFilter,
  hasEnrollmentActivitySince,
  schoolPeriodStartDayKey,
  schoolPeriodStartUtc,
} from './enrollmentPeriod';
import { schoolDayStartUtc } from './intakeCalendar';

const morningEt = new Date('2026-09-01T13:06:00.000Z'); // 9:06 AM EDT

describe('school period starts (America/New_York)', () => {
  it('uses Eastern midnight, not UTC midnight', () => {
    expect(schoolDayStartUtc('2026-09-01').toISOString()).toBe('2026-09-01T04:00:00.000Z');
    expect(schoolDayStartUtc('2026-01-15').toISOString()).toBe('2026-01-15T05:00:00.000Z');
  });

  it('treats Sept 1, 2026 as month start (not empty because files were created in August)', () => {
    expect(schoolPeriodStartDayKey('today', morningEt)).toBe('2026-09-01');
    expect(schoolPeriodStartDayKey('month', morningEt)).toBe('2026-09-01');
    expect(schoolPeriodStartDayKey('week', morningEt)).toBe('2026-08-31');
    expect(schoolPeriodStartDayKey('year', morningEt)).toBe('2026-01-01');
    expect(schoolPeriodStartUtc('month', morningEt).toISOString()).toBe('2026-09-01T04:00:00.000Z');
  });
});

describe('enrollment period matching', () => {
  const monthStart = schoolPeriodStartUtc('month', morningEt);

  it('includes a returning visit in September even when createdAt is in August', () => {
    expect(hasEnrollmentActivitySince({
      createdAt: '2026-08-28T16:49:00.000Z',
      intakeVisits: [
        { date: '2026-08-28T16:49:00.000Z' },
        { date: '2026-09-01T12:17:00.000Z' },
      ],
    }, monthStart)).toBe(true);
  });

  it('excludes an August-only student from September', () => {
    expect(hasEnrollmentActivitySince({
      createdAt: '2026-08-28T16:49:00.000Z',
      intakeVisits: [{ date: '2026-08-28T16:49:00.000Z' }],
    }, monthStart)).toBe(false);
  });

  it('includes a brand-new September registration', () => {
    expect(hasEnrollmentActivitySince({
      createdAt: '2026-09-01T13:00:00.000Z',
    }, monthStart)).toBe(true);
  });

  it('builds a Mongo filter on createdAt or visit date', () => {
    const filter = enrollmentPeriodMongoFilter(monthStart);
    expect(filter).toMatchObject({
      $or: [
        { createdAt: { $gte: monthStart.toISOString() } },
        { createdAt: { $gte: monthStart } },
        { 'intakeVisits.date': { $gte: monthStart.toISOString() } },
        { 'intakeVisits.date': { $gte: monthStart } },
      ],
    });
    expect(enrollmentPeriodMongoFilter(null)).toEqual({});
  });
});
