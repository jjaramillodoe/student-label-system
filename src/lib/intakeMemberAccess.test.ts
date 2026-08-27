import { describe, expect, it } from 'vitest';
import {
  isIntakeMemberApiAllowed,
  isIntakeMemberPageAllowed,
} from './intakeMemberAccess';

describe('isIntakeMemberPageAllowed', () => {
  it('allows intake, profile, docs, and public QR pages', () => {
    expect(isIntakeMemberPageAllowed('/intake')).toBe(true);
    expect(isIntakeMemberPageAllowed('/profile')).toBe(true);
    expect(isIntakeMemberPageAllowed('/docs')).toBe(true);
    expect(isIntakeMemberPageAllowed('/student/1979-AL-0000001')).toBe(true);
    expect(isIntakeMemberPageAllowed('/archive/box/abc')).toBe(true);
  });

  it('blocks dashboard, print, and admin pages', () => {
    expect(isIntakeMemberPageAllowed('/')).toBe(false);
    expect(isIntakeMemberPageAllowed('/admin/users')).toBe(false);
    expect(isIntakeMemberPageAllowed('/reports')).toBe(false);
  });
});

describe('isIntakeMemberApiAllowed', () => {
  it('allows the intake form APIs', () => {
    expect(isIntakeMemberApiAllowed('/api/intake/check', 'POST')).toBe(true);
    expect(isIntakeMemberApiAllowed('/api/intake/sessions', 'GET')).toBe(true);
    expect(isIntakeMemberApiAllowed('/api/intake/data-lead', 'GET')).toBe(true);
    expect(isIntakeMemberApiAllowed('/api/students', 'GET')).toBe(true);
    expect(isIntakeMemberApiAllowed('/api/students', 'POST')).toBe(true);
    expect(isIntakeMemberApiAllowed('/api/students/507f1f77bcf86cd799439011', 'PUT')).toBe(true);
    expect(isIntakeMemberApiAllowed('/api/students/507f1f77bcf86cd799439011', 'GET')).toBe(true);
    expect(isIntakeMemberApiAllowed('/api/cabinets', 'GET')).toBe(true);
    expect(isIntakeMemberApiAllowed('/api/admin/addresses/verify', 'POST')).toBe(true);
    expect(isIntakeMemberApiAllowed('/api/admin/schools/legacy-roster/search', 'GET')).toBe(true);
    expect(isIntakeMemberApiAllowed('/api/search-events', 'POST')).toBe(true);
    expect(isIntakeMemberApiAllowed('/api/profile/mfa', 'POST')).toBe(true);
    expect(isIntakeMemberApiAllowed('/api/users', 'GET')).toBe(true);
    expect(isIntakeMemberApiAllowed('/api/admin/app-settings', 'GET')).toBe(true);
    expect(isIntakeMemberApiAllowed('/api/students', 'OPTIONS')).toBe(true);
  });

  it('blocks print, admin, delete, and cabinet mutations', () => {
    expect(isIntakeMemberApiAllowed('/api/print/avery5163-docx', 'POST')).toBe(false);
    expect(isIntakeMemberApiAllowed('/api/print-history', 'GET')).toBe(false);
    expect(isIntakeMemberApiAllowed('/api/cabinets', 'POST')).toBe(false);
    expect(isIntakeMemberApiAllowed('/api/cabinets/abc', 'GET')).toBe(false);
    expect(isIntakeMemberApiAllowed('/api/students/507f1f77bcf86cd799439011', 'DELETE')).toBe(false);
    expect(isIntakeMemberApiAllowed('/api/students/bulk-upload', 'POST')).toBe(false);
    expect(isIntakeMemberApiAllowed('/api/students/email-list', 'GET')).toBe(false);
    expect(isIntakeMemberApiAllowed('/api/admin/analytics', 'GET')).toBe(false);
    expect(isIntakeMemberApiAllowed('/api/admin/app-settings', 'PATCH')).toBe(false);
    expect(isIntakeMemberApiAllowed('/api/users', 'POST')).toBe(false);
    expect(isIntakeMemberApiAllowed('/api/users/abc', 'GET')).toBe(false);
    expect(isIntakeMemberApiAllowed('/api/dashboard-stats', 'GET')).toBe(false);
  });
});
