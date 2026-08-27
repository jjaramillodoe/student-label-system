/**
 * Allowlist for seed/wipe HTTP features. Server routes read DESTRUCTIVE_ADMIN_EMAILS.
 * Client UI falls back to the default email when the env var is not public.
 */
const FALLBACK_DESTRUCTIVE_ADMIN_EMAILS = ['jjaramillo7@schools.nyc.gov'];

export function parseDestructiveAdminEmails(raw?: string | null): string[] {
  return (raw || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function allowedAdminEmails(raw = process.env.DESTRUCTIVE_ADMIN_EMAILS): string[] {
  const fromEnv = parseDestructiveAdminEmails(raw);
  return fromEnv.length > 0 ? fromEnv : FALLBACK_DESTRUCTIVE_ADMIN_EMAILS;
}

/** @deprecated Use allowedAdminEmails() — kept for existing imports. */
export const ALLOWED_ADMIN_USERS = allowedAdminEmails();

/**
 * Check if a user is allowed to access admin seeding/clearing features.
 * User must be an Admin AND in the allowed users list.
 */
export function isAllowedAdminUser(email?: string | null, role?: string | null): boolean {
  if (!email || role !== 'Admin') {
    return false;
  }
  return allowedAdminEmails().includes(email.toLowerCase());
}
