import { beforeEach, describe, expect, it, vi } from 'vitest';

const getServerSession = vi.fn();

vi.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => getServerSession(...args),
}));

vi.mock('@/lib/authOptions', () => ({ authOptions: { secret: 'test' } }));

import {
  assertSchoolAccess,
  requireAdmin,
  requireRole,
  requireSession,
  schoolScopeFilter,
} from './requireSession';

describe('requireSession', () => {
  beforeEach(() => {
    getServerSession.mockReset();
  });

  it('returns 401 when there is no session', async () => {
    getServerSession.mockResolvedValue(null);
    const auth = await requireSession();
    expect(auth.ok).toBe(false);
    if (auth.ok) return;
    expect(auth.response.status).toBe(401);
  });

  it('returns a typed user when signed in', async () => {
    getServerSession.mockResolvedValue({
      user: { email: 'a@schools.nyc.gov', role: 'Data Lead', school: 'School A' },
    });
    const auth = await requireSession();
    expect(auth.ok).toBe(true);
    if (!auth.ok) return;
    expect(auth.user.email).toBe('a@schools.nyc.gov');
    expect(auth.user.role).toBe('Data Lead');
    expect(auth.user.school).toBe('School A');
  });
});

describe('requireRole', () => {
  beforeEach(() => {
    getServerSession.mockReset();
  });

  it('returns 401 before checking role when unsigned', async () => {
    getServerSession.mockResolvedValue(null);
    const auth = await requireAdmin();
    expect(auth.ok).toBe(false);
    if (auth.ok) return;
    expect(auth.response.status).toBe(401);
  });

  it('returns 403 when the role is not allowed', async () => {
    getServerSession.mockResolvedValue({
      user: { email: 'm@schools.nyc.gov', role: 'Data Member', school: 'School A' },
    });
    const auth = await requireRole(['Admin', 'Data Lead']);
    expect(auth.ok).toBe(false);
    if (auth.ok) return;
    expect(auth.response.status).toBe(403);
  });

  it('allows a matching role', async () => {
    getServerSession.mockResolvedValue({
      user: { email: 'a@schools.nyc.gov', role: 'Admin' },
    });
    const auth = await requireAdmin();
    expect(auth.ok).toBe(true);
  });
});

describe('assertSchoolAccess', () => {
  it('lets Admin through and scopes everyone else', () => {
    expect(assertSchoolAccess({ role: 'Admin' }, 'Other')).toBe(true);
    expect(assertSchoolAccess({ role: 'Data Lead', school: 'A' }, 'A')).toBe(true);
    expect(assertSchoolAccess({ role: 'Data Lead', school: 'A' }, 'B')).toBe(false);
    expect(assertSchoolAccess({ role: 'Data Lead', school: 'A' }, null)).toBe(false);
  });
});

describe('schoolScopeFilter', () => {
  it('is empty for Admin and school-scoped otherwise', () => {
    expect(schoolScopeFilter({ role: 'Admin' })).toEqual({});
    expect(schoolScopeFilter({ role: 'Data Lead', school: ' A ' })).toEqual({ school: 'A' });
    expect(schoolScopeFilter({ role: 'Data Member' })).toEqual({ school: '__none__' });
  });
});
