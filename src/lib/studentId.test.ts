import { describe, expect, it } from 'vitest';
import {
  cleanIdComponent,
  formatAssistsDobDigits,
  generateLabelId,
  generateStudentId,
  resolveAgencyId,
  resolveStudentId,
} from './studentId';

describe('cleanIdComponent', () => {
  it('strips diacritics, punctuation, and spaces, then uppercases', () => {
    expect(cleanIdComponent("O'Brien")).toBe('OBRIEN');
    expect(cleanIdComponent('José')).toBe('JOSE');
    expect(cleanIdComponent('Núñez-García')).toBe('NUNEZGARCIA');
  });
});

describe('formatAssistsDobDigits', () => {
  it('uses unpadded day + month + year (ASISTS style)', () => {
    expect(formatAssistsDobDigits('1979-05-22')).toBe('2251979');
    expect(formatAssistsDobDigits('1958-01-02')).toBe('211958');
    expect(formatAssistsDobDigits('2000-12-31')).toBe('31122000');
  });

  it('falls back to digits-only for non-ISO input', () => {
    expect(formatAssistsDobDigits('05/22/1979')).toBe('05221979');
  });
});

describe('generateStudentId', () => {
  it('concatenates last, first, agency, and unpadded DOB', () => {
    expect(generateStudentId('Elsa', 'Cueva', 'R01', '1979-05-22')).toBe(
      'CUEVAELSAR012251979',
    );
  });
});

describe('resolveStudentId', () => {
  it('prefers a cleaned ASISTS/legacy external id when present', () => {
    expect(resolveStudentId({
      firstName: 'Fitzroy',
      lastName: 'Smith',
      agencyId: 'R08',
      dob: '1958-01-02',
      preferredExternalId: 'SMITHFITZROYR082522026211958',
    })).toBe('SMITHFITZROYR082522026211958');
  });

  it('generates when preferred id is empty', () => {
    expect(resolveStudentId({
      firstName: 'Elsa',
      lastName: 'Cueva',
      agencyId: 'R01',
      dob: '1979-05-22',
      preferredExternalId: '  ',
    })).toBe('CUEVAELSAR012251979');
  });
});

describe('generateLabelId', () => {
  it('pads the counter to 7 digits with birth year and initials', () => {
    expect(generateLabelId('Elsa', 'Cueva', '1979-05-22', 48)).toBe('1979-EC-0000048');
  });
});

describe('resolveAgencyId', () => {
  it('prefers the stored school agency id', () => {
    expect(resolveAgencyId('School 1', 'R99')).toBe('R99');
  });

  it('uses the default map, then trailing digits, then R00', () => {
    expect(resolveAgencyId('School 3')).toBe('R03');
    expect(resolveAgencyId('School 12')).toBe('R12');
    expect(resolveAgencyId('Unknown Campus')).toBe('R00');
  });
});
