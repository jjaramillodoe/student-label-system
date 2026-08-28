import { describe, expect, it } from 'vitest';
import {
  EMPLOYMENT_STATUS_OPTIONS,
  INTAKE_BARRIERS,
  RACE_IDENTITY_OPTIONS,
  emptyBarrierAnswers,
  intakeDemographicsError,
  normalizeMiddleInitial,
  parseIntakeDemographics,
} from './intakeDemographics';

function completeNewStudent() {
  return {
    employmentStatus: 'employed-full-time' as const,
    hispanicLatinoOrigin: 'hispanic' as const,
    raceIdentities: ['asian'],
    ...Object.fromEntries(INTAKE_BARRIERS.map((b) => [b.key, 'N'])),
  };
}

describe('normalizeMiddleInitial', () => {
  it('keeps a single letter and strips extras', () => {
    expect(normalizeMiddleInitial('ab')).toBe('A');
    expect(normalizeMiddleInitial('9')).toBe('');
    expect(normalizeMiddleInitial('M.')).toBe('M');
  });
});

describe('intakeDemographicsError', () => {
  it('requires employment, origin, at least one race, and every barrier for NEW', () => {
    expect(intakeDemographicsError({}, { required: true })).toBe('Select an employment status.');
    expect(intakeDemographicsError({
      employmentStatus: 'employed-full-time',
    }, { required: true })).toBe('Select Hispanic / Latino origin.');
    expect(intakeDemographicsError({
      employmentStatus: 'employed-full-time',
      hispanicLatinoOrigin: 'hispanic',
    }, { required: true })).toBe('Select at least one race / identity.');
    expect(intakeDemographicsError({
      employmentStatus: 'employed-full-time',
      hispanicLatinoOrigin: 'hispanic',
      raceIdentities: ['asian'],
    }, { required: true })).toMatch(/Answer Yes or No for every barrier/);
  });

  it('accepts a complete NEW payload', () => {
    expect(intakeDemographicsError(completeNewStudent(), { required: true })).toBeNull();
  });

  it('is optional when not required', () => {
    expect(intakeDemographicsError({}, { required: false })).toBeNull();
  });
});

describe('parseIntakeDemographics', () => {
  it('copies cell phone onto home phone when same-as-cell is checked', () => {
    const { values, error } = parseIntakeDemographics({
      ...completeNewStudent(),
      cellPhone: '2125550100',
      homePhone: '7185550199',
      homePhoneSameAsCell: true,
    }, { required: true });
    expect(error).toBeNull();
    expect(values.homePhone).toBe('2125550100');
    expect(values.phone).toBe('2125550100');
    expect(values.cellPhone).toBe('2125550100');
  });

  it('falls back to legacy phone for home phone', () => {
    const { values } = parseIntakeDemographics({
      phone: '6465550111',
    }, { required: false });
    expect(values.homePhone).toBe('6465550111');
    expect(values.phone).toBe('6465550111');
  });
});

describe('option catalogs', () => {
  it('covers the ISRF employment and race lists', () => {
    expect(EMPLOYMENT_STATUS_OPTIONS).toHaveLength(7);
    expect(RACE_IDENTITY_OPTIONS).toHaveLength(10);
    expect(INTAKE_BARRIERS).toHaveLength(17);
    expect(Object.keys(emptyBarrierAnswers())).toHaveLength(17);
  });
});
