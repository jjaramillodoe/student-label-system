import { AsyncLocalStorage } from 'async_hooks';
import type { NextRequest } from 'next/server';

/** Carries the incoming NextAuth request into authorize() for IP / UA logging. */
export const authRequestStore = new AsyncLocalStorage<NextRequest>();

export function getAuthRequest(): NextRequest | undefined {
  return authRequestStore.getStore();
}

export function getClientIp(req?: NextRequest): string | null {
  if (!req) return null;
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('x-real-ip') || req.headers.get('x-vercel-forwarded-for') || null;
}

export function getClientUserAgent(req?: NextRequest): string | null {
  if (!req) return null;
  return req.headers.get('user-agent');
}
