import { describe, expect, it } from 'vitest';
import {
  canAssignUser,
  canManageUser,
  canRunSecurityAction,
  userListFilter,
} from './userManagement';

const admin = { role: 'Admin', school: 'District 79', email: 'admin@schools.nyc.gov' };
const lead = { role: 'Data Lead', school: 'School 8', email: 'lead@schools.nyc.gov' };

describe('userListFilter', () => {
  it('shows Admins everyone and Data Leads their own school', () => {
    expect(userListFilter(admin)).toEqual({});
    expect(userListFilter(lead)).toEqual({ school: 'School 8' });
  });

  it('shows nothing to other roles or a Data Lead with no school', () => {
    expect(userListFilter({ role: 'Data Member', school: 'School 8' })).toBeNull();
    expect(userListFilter({ role: 'Data Lead', school: '' })).toBeNull();
  });
});

describe('canManageUser', () => {
  it('lets a Data Lead manage Data Members and Intake Members at their school', () => {
    expect(canManageUser(lead, { role: 'Data Member', school: 'School 8', email: 'm@x.gov' })).toBe(true);
    expect(canManageUser(lead, { role: 'Intake Member', school: 'School 8', email: 'i@x.gov' })).toBe(true);
  });

  it('blocks other schools, Admins, other Data Leads, and themselves', () => {
    expect(canManageUser(lead, { role: 'Data Member', school: 'School 9' })).toBe(false);
    expect(canManageUser(lead, { role: 'Admin', school: 'School 8' })).toBe(false);
    expect(canManageUser(lead, { role: 'Data Lead', school: 'School 8', email: 'other@x.gov' })).toBe(false);
    expect(canManageUser(lead, { ...lead, role: 'Data Member', email: 'LEAD@schools.nyc.gov' })).toBe(false);
  });

  it('lets Admins manage anyone', () => {
    expect(canManageUser(admin, { role: 'Data Lead', school: 'School 9' })).toBe(true);
  });
});

describe('canAssignUser', () => {
  it('keeps Data Lead assignments to manageable roles at their own school', () => {
    expect(canAssignUser(lead, { role: 'Data Member', school: 'School 8' })).toBe(true);
    expect(canAssignUser(lead, { role: 'Data Lead', school: 'School 8' })).toBe(false);
    expect(canAssignUser(lead, { role: 'Admin', school: 'School 8' })).toBe(false);
    expect(canAssignUser(lead, { role: 'Data Member', school: 'School 9' })).toBe(false);
  });
});

describe('canRunSecurityAction', () => {
  it('allows password and unlock actions but not MFA changes for Data Leads', () => {
    expect(canRunSecurityAction(lead, 'reset-password')).toBe(true);
    expect(canRunSecurityAction(lead, 'unlock-account')).toBe(true);
    expect(canRunSecurityAction(lead, 'set-mfa-bypass')).toBe(false);
    expect(canRunSecurityAction(lead, 'disable-mfa')).toBe(false);
    expect(canRunSecurityAction(admin, 'disable-mfa')).toBe(true);
  });
});
