import { NextResponse } from 'next/server';

/**
 * Seed / wipe / one-shot migrate HTTP routes must not run in production.
 * Override with ALLOW_DESTRUCTIVE_HTTP=1 only for a controlled emergency.
 */
export function isDestructiveHttpBlocked(): boolean {
  const override = (process.env.ALLOW_DESTRUCTIVE_HTTP || '').trim();
  if (override === '1' || override.toLowerCase() === 'true') return false;

  const vercel = (process.env.VERCEL_ENV || '').trim();
  if (vercel === 'preview' || vercel === 'development') return false;
  if (vercel === 'production') return true;

  return process.env.NODE_ENV === 'production';
}

export const DESTRUCTIVE_HTTP_DISABLED_MESSAGE =
  'This operation is disabled in production. Use the CLI scripts in /scripts.';

export function destructiveHttpGuard(): NextResponse | null {
  if (!isDestructiveHttpBlocked()) return null;
  return NextResponse.json({ error: DESTRUCTIVE_HTTP_DISABLED_MESSAGE }, { status: 403 });
}