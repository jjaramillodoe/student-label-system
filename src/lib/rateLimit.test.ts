import { describe, expect, it } from 'vitest';
import { consumeRateLimit, resetRateLimitBuckets } from './rateLimit';

describe('consumeRateLimit', () => {
  it('allows up to the limit then blocks', () => {
    resetRateLimitBuckets();
    const key = 'test:ip';
    for (let i = 0; i < 3; i++) {
      expect(consumeRateLimit({ key, limit: 3, windowMs: 60_000 }).ok).toBe(true);
    }
    const blocked = consumeRateLimit({ key, limit: 3, windowMs: 60_000 });
    expect(blocked.ok).toBe(false);
    if (blocked.ok) return;
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it('tracks keys independently', () => {
    resetRateLimitBuckets();
    expect(consumeRateLimit({ key: 'a', limit: 1, windowMs: 60_000 }).ok).toBe(true);
    expect(consumeRateLimit({ key: 'b', limit: 1, windowMs: 60_000 }).ok).toBe(true);
    expect(consumeRateLimit({ key: 'a', limit: 1, windowMs: 60_000 }).ok).toBe(false);
  });
});
