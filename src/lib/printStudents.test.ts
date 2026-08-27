import { describe, expect, it } from 'vitest';
import { authorizeStudentPrintAccess } from './studentAccess';
import { PRINT_MAX_STUDENTS, parsePrintStudentIds, toPrintLabelStudent } from './printStudents';

const ID_A = '507f1f77bcf86cd799439011';
const ID_B = '507f1f77bcf86cd799439012';

describe('authorizeStudentPrintAccess', () => {
  it('rejects Intake Member even for same-school records', () => {
    expect(authorizeStudentPrintAccess({
      role: 'Intake Member',
      userSchool: 'School A',
      studentExists: true,
      studentSchool: 'School A',
    })).toEqual({
      ok: false,
      status: 403,
      error: 'Forbidden — Intake Member cannot print labels',
    });
  });

  it('allows Admin, Data Lead, and Data Member', () => {
    for (const role of ['Admin', 'Data Lead', 'Data Member']) {
      expect(authorizeStudentPrintAccess({
        role,
        userSchool: 'School A',
        studentExists: true,
        studentSchool: 'School A',
      }).ok).toBe(true);
    }
  });

  it('hides other-school records as 404 for non-admins', () => {
    expect(authorizeStudentPrintAccess({
      role: 'Data Member',
      userSchool: 'School A',
      studentExists: true,
      studentSchool: 'School B',
    })).toMatchObject({ ok: false, status: 404 });
  });
});

describe('parsePrintStudentIds', () => {
  it('reads ids and skipStock', () => {
    expect(parsePrintStudentIds({ ids: [ID_A, ID_B], skipStock: true })).toEqual({
      ok: true,
      ids: [ID_A, ID_B],
      skipStock: true,
    });
  });

  it('legacy students[] only uses _id and ignores client PII', () => {
    const parsed = parsePrintStudentIds({
      students: [{
        _id: ID_A,
        firstName: 'Forged',
        lastName: 'Name',
        dob: '1900-01-01',
        labelId: 'FAKE-ID',
      }],
    });
    expect(parsed).toEqual({ ok: true, ids: [ID_A], skipStock: false });
  });

  it('rejects missing, invalid, or oversized id lists', () => {
    expect(parsePrintStudentIds({ ids: [] })).toMatchObject({ ok: false, status: 400 });
    expect(parsePrintStudentIds({ ids: ['not-an-id'] })).toMatchObject({ ok: false, status: 400 });
    expect(parsePrintStudentIds({
      ids: Array.from({ length: PRINT_MAX_STUDENTS + 1 }, () => ID_A),
    })).toMatchObject({ ok: false, status: 400 });
  });
});

describe('toPrintLabelStudent', () => {
  it('copies only label fields from a Mongo document', () => {
    expect(toPrintLabelStudent({
      _id: ID_A,
      firstName: 'Elsa',
      lastName: 'Cueva',
      dob: '1979-05-22',
      labelId: '1979-EC-0000048',
      studentId: 'CUEVAELSAR012251979',
      school: 'School 1',
      notes: 'secret',
      phone: '555',
    })).toEqual({
      _id: ID_A,
      firstName: 'Elsa',
      lastName: 'Cueva',
      dob: '1979-05-22',
      labelId: '1979-EC-0000048',
      studentId: 'CUEVAELSAR012251979',
      school: 'School 1',
      cabinet: undefined,
      drawer: undefined,
    });
  });
});
