import { timingSafeEqual } from 'node:crypto';

export function extractBearerToken(authorization: string | null | undefined): string | null {
  const value = String(authorization || '');
  if (!value.startsWith('Bearer ')) return null;
  const token = value.slice(7).trim();
  return token || null;
}

export function timingSafeEqualString(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Compare an Authorization Bearer token to a configured secret. */
export function isAuthorizedBySharedSecret(
  authorization: string | null | undefined,
  secret: string | undefined | null,
): boolean {
  if (!secret) return false;
  const token = extractBearerToken(authorization);
  if (!token) return false;
  return timingSafeEqualString(token, secret);
}
