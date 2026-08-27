import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

type WindowState = { count: number; windowStart: number };

const buckets = new Map<string, WindowState>();
const MAX_KEYS = 10_000;

export type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSec: number };

function prune(now: number, windowMs: number) {
  if (buckets.size < MAX_KEYS) return;
  for (const [key, state] of buckets) {
    if (now - state.windowStart >= windowMs * 2) buckets.delete(key);
    if (buckets.size < MAX_KEYS / 2) break;
  }
  if (buckets.size >= MAX_KEYS) {
    const oldest = buckets.keys().next().value;
    if (oldest) buckets.delete(oldest);
  }
}

/** Fixed-window counter. Best-effort on Vercel (per isolate); pair with Firewall. */
export function consumeRateLimit(opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  prune(now, opts.windowMs);
  const current = buckets.get(opts.key);
  if (!current || now - current.windowStart >= opts.windowMs) {
    buckets.set(opts.key, { count: 1, windowStart: now });
    return { ok: true, remaining: opts.limit - 1 };
  }
  if (current.count >= opts.limit) {
    const retryAfterSec = Math.max(1, Math.ceil((current.windowStart + opts.windowMs - now) / 1000));
    return { ok: false, retryAfterSec };
  }
  current.count += 1;
  return { ok: true, remaining: opts.limit - current.count };
}

export function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}

export function rateLimitResponse(retryAfterSec: number): NextResponse {
  return NextResponse.json(
    { error: 'Too many requests' },
    {
      status: 429,
      headers: { 'Retry-After': String(retryAfterSec) },
    },
  );
}

export const LOOKUP_RATE = { limit: 30, windowMs: 60_000 } as const;
export const SYNC_RATE = { limit: 60, windowMs: 60_000 } as const;
export const AUTH_POST_RATE = { limit: 20, windowMs: 60_000 } as const;

/** Reset in-memory buckets (tests only). */
export function resetRateLimitBuckets() {
  buckets.clear();
}
