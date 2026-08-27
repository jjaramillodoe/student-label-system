import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/authOptions';

export type SessionUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role: string;
  school?: string;
  forcePasswordChange?: boolean;
  forceMfaSetup?: boolean;
};

export type AuthedSession = {
  ok: true;
  user: SessionUser;
};

export type AuthFailure = {
  ok: false;
  response: NextResponse;
};

export type AuthResult = AuthedSession | AuthFailure;

export const ADMIN_ROLE = 'Admin';
export const DATA_LEAD_ROLE = 'Data Lead';
export const ADMIN_OR_DATA_LEAD = [ADMIN_ROLE, DATA_LEAD_ROLE] as const;

function unauthorized(message = 'Unauthorized'): AuthFailure {
  return { ok: false, response: NextResponse.json({ error: message }, { status: 401 }) };
}

function forbidden(message = 'Forbidden'): AuthFailure {
  return { ok: false, response: NextResponse.json({ error: message }, { status: 403 }) };
}

function toSessionUser(user: {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: string;
  school?: string;
  forcePasswordChange?: boolean;
  forceMfaSetup?: boolean;
}): SessionUser {
  return {
    name: user.name,
    email: user.email,
    image: user.image,
    role: user.role || '',
    school: typeof user.school === 'string' ? user.school : undefined,
    forcePasswordChange: user.forcePasswordChange,
    forceMfaSetup: user.forceMfaSetup,
  };
}

/** Require a signed-in NextAuth session. Unauthenticated callers get 401. */
export async function requireSession(): Promise<AuthResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();
  return { ok: true, user: toSessionUser(session.user) };
}

/** Require a session whose role is in `roles`. Missing session → 401; wrong role → 403. */
export async function requireRole(
  roles: string | readonly string[],
  message = 'Forbidden',
): Promise<AuthResult> {
  const auth = await requireSession();
  if (!auth.ok) return auth;
  const allowed = typeof roles === 'string' ? [roles] : roles;
  if (!allowed.includes(auth.user.role)) return forbidden(message);
  return auth;
}

export async function requireAdmin(message = 'Forbidden'): Promise<AuthResult> {
  return requireRole(ADMIN_ROLE, message);
}

export async function requireAdminOrDataLead(message = 'Forbidden'): Promise<AuthResult> {
  return requireRole(ADMIN_OR_DATA_LEAD, message);
}

/**
 * Admin may access any school. Everyone else must have a school that matches
 * the resource (trimmed, case-sensitive — same as studentAccess).
 */
export function assertSchoolAccess(
  user: Pick<SessionUser, 'role' | 'school'>,
  resourceSchool?: string | null,
): boolean {
  if (user.role === ADMIN_ROLE) return true;
  const left = user.school?.trim();
  const right = resourceSchool?.trim();
  if (!left || !right) return false;
  return left === right;
}

/** Mongo filter: Admin sees all schools; others are scoped to their assigned school. */
export function schoolScopeFilter(
  user: Pick<SessionUser, 'role' | 'school'>,
): Record<string, unknown> {
  if (user.role === ADMIN_ROLE) return {};
  if (user.school?.trim()) return { school: user.school.trim() };
  return { school: '__none__' };
}
