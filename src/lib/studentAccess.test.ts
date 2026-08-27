import { describe, expect, it } from 'vitest';
import { authorizeStudentAccess, authorizeStudentSchoolChange } from './studentAccess';

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

  it('rejects unknown roles', () => {
    expect(authorizeStudentAccess({
      role: 'Visitor',
      userSchool: 'School A',
      action: 'read',
      studentExists: true,
      studentSchool: 'School A',
    })).toMatchObject({ ok: false, status: 403 });
  });

  it('rejects school-scoped roles with no school assigned', () => {
    expect(authorizeStudentAccess({
      role: 'Data Lead',
      userSchool: null,
      action: 'read',
      studentExists: true,
      studentSchool: 'School A',
    })).toMatchObject({ ok: false, status: 403 });
  });
});

describe('authorizeStudentSchoolChange', () => {
  it('allows omitting school or keeping the current school', () => {
    expect(authorizeStudentSchoolChange({
      role: 'Data Lead',
      currentSchool: 'School A',
    }).ok).toBe(true);
    expect(authorizeStudentSchoolChange({
      role: 'Data Member',
      currentSchool: 'School A',
      requestedSchool: 'School A',
    }).ok).toBe(true);
  });

  it('allows Admin to move a student to another school', () => {
    expect(authorizeStudentSchoolChange({
      role: 'Admin',
      currentSchool: 'School A',
      requestedSchool: 'School B',
    }).ok).toBe(true);
  });

  it('blocks non-admins from changing school', () => {
    expect(authorizeStudentSchoolChange({
      role: 'Data Lead',
      currentSchool: 'School A',
      requestedSchool: 'School B',
    })).toEqual({
      ok: false,
      status: 403,
      error: 'Forbidden — cannot move a student to another school',
    });
  });
});
