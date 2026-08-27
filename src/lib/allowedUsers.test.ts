import { describe, expect, it } from 'vitest';
import { allowedAdminEmails, isAllowedAdminUser, parseDestructiveAdminEmails } from './allowedUsers';

describe('allowedUsers', () => {
  it('parses comma-separated emails', () => {
    expect(parseDestructiveAdminEmails(' A@Schools.nyc.gov, b@schools.nyc.gov ')).toEqual([
      'a@schools.nyc.gov',
      'b@schools.nyc.gov',
    ]);
  });

  it('falls back when env is empty', () => {
    expect(allowedAdminEmails('')).toEqual(['jjaramillo7@schools.nyc.gov']);
    expect(allowedAdminEmails('lead@schools.nyc.gov')).toEqual(['lead@schools.nyc.gov']);
  });

  it('requires Admin role', () => {
    expect(isAllowedAdminUser('jjaramillo7@schools.nyc.gov', 'Data Lead')).toBe(false);
  });
});
