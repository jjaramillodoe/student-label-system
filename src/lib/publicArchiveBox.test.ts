import { describe, expect, it } from 'vitest';
import {
  PUBLIC_ARCHIVE_BOX_STUDENT_KEYS,
  toPublicArchiveBoxStudent,
} from './publicArchiveBox';

describe('toPublicArchiveBoxStudent', () => {
  it('omits DOB, status, and extra Mongo fields', () => {
    const out = toPublicArchiveBoxStudent({
      _id: 'abc',
      firstName: 'Ada',
      lastName: 'Lovelace',
      labelId: '1979-AL-0000001',
      studentId: 'LOVELACEADA…',
      dob: '1815-12-10',
      status: 'Archived',
      email: 'secret@example.com',
      notes: 'internal',
    });
    expect(Object.keys(out).sort()).toEqual([...PUBLIC_ARCHIVE_BOX_STUDENT_KEYS].sort());
    expect(out).not.toHaveProperty('dob');
    expect(out).not.toHaveProperty('email');
  });
});
