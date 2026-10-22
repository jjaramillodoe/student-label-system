import { describe, expect, it } from 'vitest';
import {
  buildStudentFieldSearchConditions,
  buildStudentSearchOrConditions,
  escapeRegex,
  isStudentSearchQueryValid,
  normalizeDobToIso,
} from './studentSearch';

describe('escapeRegex', () => {
  it('escapes regex metacharacters used in Mongo $regex', () => {
    expect(escapeRegex('1979-EC-0000048')).toBe('1979-EC-0000048');
    expect(escapeRegex('a.*b')).toBe('a\\.\\*b');
    expect(escapeRegex('foo(bar)')).toBe('foo\\(bar\\)');
  });
});

describe('isStudentSearchQueryValid', () => {
  it('rejects empty and single-character non-date queries', () => {
    expect(isStudentSearchQueryValid('')).toBe(false);
    expect(isStudentSearchQueryValid('a')).toBe(false);
    expect(isStudentSearchQueryValid('ab')).toBe(true);
  });

  it('allows a recognizable DOB even when short', () => {
    expect(isStudentSearchQueryValid('1979-05-22')).toBe(true);
    expect(isStudentSearchQueryValid('05/22/1979')).toBe(true);
  });
});

describe('normalizeDobToIso', () => {
  it('accepts ISO, US slashes, and compact digits', () => {
    expect(normalizeDobToIso('1979-05-22')).toBe('1979-05-22');
    expect(normalizeDobToIso('05/22/1979')).toBe('1979-05-22');
    expect(normalizeDobToIso('05221979')).toBe('1979-05-22');
  });

  it('rejects invalid calendar dates', () => {
    expect(normalizeDobToIso('1979-13-40')).toBeNull();
    expect(normalizeDobToIso('not-a-date')).toBeNull();
  });
});

describe('buildStudentSearchOrConditions', () => {
  it('does not fall back to name/labelId regex for DOB-only queries', () => {
    const or = buildStudentSearchOrConditions('1979/05/22');
    expect(or.some((clause) => 'firstName' in clause || 'labelId' in clause)).toBe(false);
    expect(or.some((clause) => clause.dob === '1979-05-22')).toBe(true);
  });
});

describe('buildStudentFieldSearchConditions', () => {
  it('ANDs first name, last name, and normalized DOB', () => {
    const and = buildStudentFieldSearchConditions({ firstName: 'Mary', lastName: "O'Neil", dob: '01/15/1990' });
    expect(and).toEqual([
      { firstName: { $regex: 'Mary', $options: 'i' } },
      { lastName: { $regex: "O'Neil", $options: 'i' } },
      { dob: '1990-01-15' },
    ]);
  });

  it('skips blank fields and rejects an unrecognizable DOB', () => {
    expect(buildStudentFieldSearchConditions({ lastName: ' Smith ' })).toEqual([
      { lastName: { $regex: 'Smith', $options: 'i' } },
    ]);
    expect(buildStudentFieldSearchConditions({ firstName: 'Ann', dob: '13/45/1990' })).toBeNull();
  });
});
