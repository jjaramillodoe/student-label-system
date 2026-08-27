import { describe, expect, it } from 'vitest';
import { authorizeStudentAccess } from './studentAccess';

describe('authorizeStudentAccess', () => {
  it('requires a role (session)', () => {
    expect(authorizeStudentAccess({
      role: undefined,
      action: 'read',
      studentExists: true,
      studentSchool: 'School A',
    })).toEqual({ ok: false, status: 401, error: 'Unauthorized' });
  });

  it('allows Admin to read, update, and delete any school', () => {
    const base = {
      role: 'Admin',
      userSchool: 'District',
      studentExists: true,
      studentSchool: 'Other School',
    };
    expect(authorizeStudentAccess({ ...base, action: 'read' }).ok).toBe(true);
    expect(authorizeStudentAccess({ ...base, action: 'update' }).ok).toBe(true);
    expect(authorizeStudentAccess({ ...base, action: 'delete' }).ok).toBe(true);
  });

  it('allows same-school Data Member and Intake Member to read and update, not delete', () => {
    for (const role of ['Data Member', 'Intake Member']) {
      const base = {
        role,
        userSchool: 'School A',
        studentExists: true,
        studentSchool: 'School A',
      };
      expect(authorizeStudentAccess({ ...base, action: 'read' }).ok).toBe(true);
      expect(authorizeStudentAccess({ ...base, action: 'update' }).ok).toBe(true);
      expect(authorizeStudentAccess({ ...base, action: 'delete' })).toMatchObject({
        ok: false,
        status: 403,
      });
    }
  });

  it('allows same-school Data Lead to delete', () => {
    expect(authorizeStudentAccess({
      role: 'Data Lead',
      userSchool: 'School A',
      action: 'delete',
      studentExists: true,
      studentSchool: 'School A',
    }).ok).toBe(true);
  });

  it('hides other-school records as 404', () => {
    expect(authorizeStudentAccess({
      role: 'Data Lead',
      userSchool: 'School A',
      action: 'read',
      studentExists: true,
      studentSchool: 'School B',
    })).toEqual({ ok: false, status: 404, error: 'Student not found' });
  });

  it('returns 404 when the student does not exist', () => {
    expect(authorizeStudentAccess({
      role: 'Admin',
      action: 'read',
      studentExists: false,
    })).toEqual({ ok: false, status: 404, error: 'Student not found' });
  });
});
