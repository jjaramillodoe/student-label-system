import { afterEach, describe, expect, it, vi } from 'vitest';
import { LOCKOUT_DURATION_MS, LOCKOUT_THRESHOLD, isAccountLocked } from './authLockout';

describe('isAccountLocked', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('is false when lockedUntil is missing or invalid', () => {
    expect(isAccountLocked({})).toBe(false);
    expect(isAccountLocked({ lockedUntil: null })).toBe(false);
    expect(isAccountLocked({ lockedUntil: 'not-a-date' })).toBe(false);
  });

  it('is true only while lockedUntil is in the future', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-27T12:00:00.000Z'));
    expect(isAccountLocked({ lockedUntil: '2026-08-27T12:30:00.000Z' })).toBe(true);
    expect(isAccountLocked({ lockedUntil: '2026-08-27T11:59:59.000Z' })).toBe(false);
    expect(isAccountLocked({ lockedUntil: new Date('2026-08-27T12:00:01.000Z') })).toBe(true);
  });
});

describe('lockout constants', () => {
  it('locks after 8 failures for 30 minutes', () => {
    expect(LOCKOUT_THRESHOLD).toBe(8);
    expect(LOCKOUT_DURATION_MS).toBe(30 * 60 * 1000);
  });
});
