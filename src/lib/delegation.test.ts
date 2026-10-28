import { describe, expect, it } from 'vitest';
import {
  canDelegate,
  delegationDays,
  delegationPhase,
  effectiveRole,
  rangesOverlap,
  schoolToday,
  validateDelegationDates,
} from './delegation';

// 2026-10-28 at 9pm in New York is already 2026-10-29 in UTC.
const evening = new Date('2026-10-29T01:00:00.000Z');

describe('schoolToday', () => {
  it('uses the New York date', () => {
    expect(schoolToday(evening)).toBe('2026-10-28');
  });
});

describe('validateDelegationDates', () => {
  it('accepts a range starting today, up to 30 days', () => {
    expect(validateDelegationDates({ startDate: '2026-10-28', endDate: '2026-11-26' }, evening))
      .toEqual({ startDate: '2026-10-28', endDate: '2026-11-26' });
    expect(delegationDays('2026-10-28', '2026-11-26')).toBe(30);
  });

  it('rejects past starts, reversed ranges, bad dates, and more than 30 days', () => {
    expect(validateDelegationDates({ startDate: '2026-10-27', endDate: '2026-10-30' }, evening)).toHaveProperty('error');
    expect(validateDelegationDates({ startDate: '2026-11-05', endDate: '2026-11-01' }, evening)).toHaveProperty('error');
    expect(validateDelegationDates({ startDate: '2026-02-30', endDate: '2026-03-02' }, evening)).toHaveProperty('error');
    expect(validateDelegationDates({ startDate: '2026-10-28', endDate: '2026-11-27' }, evening)).toHaveProperty('error');
  });
});

describe('delegationPhase and effectiveRole', () => {
  const approved = { status: 'approved' as const, startDate: '2026-10-28', endDate: '2026-10-30' };

  it('is active through the whole end date', () => {
    expect(delegationPhase(approved, evening)).toBe('active');
    expect(delegationPhase(approved, new Date('2026-10-31T03:59:00.000Z'))).toBe('active');
    expect(delegationPhase(approved, new Date('2026-10-31T04:01:00.000Z'))).toBe('expired');
    expect(delegationPhase({ ...approved, startDate: '2026-10-29' }, evening)).toBe('scheduled');
    expect(delegationPhase({ ...approved, status: 'pending' }, evening)).toBe('pending');
  });

  it('raises only Data Members with an active approved delegation', () => {
    expect(effectiveRole('Data Member', approved, evening)).toBe('Data Lead');
    expect(effectiveRole('Data Member', { ...approved, status: 'revoked' }, evening)).toBe('Data Member');
    expect(effectiveRole('Intake Member', approved, evening)).toBe('Intake Member');
    expect(effectiveRole('Data Member', null, evening)).toBe('Data Member');
  });
});

describe('rangesOverlap', () => {
  it('treats shared end days as overlapping', () => {
    const a = { startDate: '2026-11-01', endDate: '2026-11-10' };
    expect(rangesOverlap(a, { startDate: '2026-11-10', endDate: '2026-11-12' })).toBe(true);
    expect(rangesOverlap(a, { startDate: '2026-11-11', endDate: '2026-11-12' })).toBe(false);
  });
});

describe('canDelegate', () => {
  it('allows Admins and real Data Leads, not acting ones', () => {
    expect(canDelegate({ role: 'Admin' })).toBe(true);
    expect(canDelegate({ role: 'Data Lead', school: 'School 8' })).toBe(true);
    expect(canDelegate({ role: 'Data Lead', school: 'School 8', actingDataLeadUntil: '2026-11-10' })).toBe(false);
    expect(canDelegate({ role: 'Data Member', school: 'School 8' })).toBe(false);
  });
});
