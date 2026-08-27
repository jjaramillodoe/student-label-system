/** Failures before temporary lock (password + MFA fails count). */
export const LOCKOUT_THRESHOLD = 8;
/** Lock duration after threshold. */
export const LOCKOUT_DURATION_MS = 30 * 60 * 1000;

export function isAccountLocked(user: {
  lockedUntil?: string | Date | null;
}): boolean {
  if (!user?.lockedUntil) return false;
  const until = new Date(user.lockedUntil).getTime();
  return Number.isFinite(until) && until > Date.now();
}
