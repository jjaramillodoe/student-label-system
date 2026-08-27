import { describe, expect, it } from 'vitest';
import {
  PUBLIC_STUDENT_LOOKUP_KEYS,
  toPublicStudentLookup,
} from './publicStudentLookup';

const FORBIDDEN_KEYS = [
  'email',
  'phone',
  'gender',
  'notes',
  'address',
  'street',
  'zip',
  'city',
  'intakeVisits',
  'timeIn',
  'timeOut',
  'createdBy',
  'updatedAt',
  'createdAt',
  'siblingWith',
  'password',
  'mfaSecret',
  'geoclient',
  'addressValidationStatus',
];

describe('toPublicStudentLookup', () => {
  it('returns only the public allowlist even when the source document has extra PII', () => {
    const result = toPublicStudentLookup(
      {
        _id: { toString: () => '507f1f77bcf86cd799439011' },
        firstName: 'Ada',
        lastName: 'Lovelace',
        labelId: '1979-AL-0000001',
        studentId: 'LOVELACEADA123',
        dob: '1990-01-15',
        school: 'Example Adult Ed',
        status: 'Active',
        program: 'ESL',
        archived: false,
        cabinet: { toString: () => '507f1f77bcf86cd799439012' },
        drawer: 'drawer-1',
        drawerSection: 'A',
        email: 'ada@example.com',
        phone: '555-0100',
        gender: 'Female',
        notes: 'Internal case notes',
        address: '123 Main St',
        intakeVisits: [{ date: '2026-01-01' }],
        createdBy: { email: 'staff@schools.nyc.gov' },
        siblingWith: ['507f1f77bcf86cd799439013'],
        password: 'nope',
        mfaSecret: 'nope',
      },
      {
        cabinetName: 'Cabinet 1',
        drawerName: 'Drawer A',
        siblings: [
          {
            _id: '507f1f77bcf86cd799439013',
            firstName: 'Annabella',
            lastName: 'Lovelace',
            labelId: '1979-AL-0000002',
          },
        ],
      },
    );

    expect(Object.keys(result).sort()).toEqual([...PUBLIC_STUDENT_LOOKUP_KEYS].sort());
    for (const key of FORBIDDEN_KEYS) {
      expect(result).not.toHaveProperty(key);
    }
    expect(result.firstName).toBe('Ada');
    expect(result.labelId).toBe('1979-AL-0000001');
    expect(result.cabinet).toBe('507f1f77bcf86cd799439012');
    expect(result.cabinetName).toBe('Cabinet 1');
    expect(result.siblings).toHaveLength(1);
  });
});
