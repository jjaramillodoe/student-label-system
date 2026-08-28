import { describe, expect, it } from 'vitest';
import {
  applyFillIfMissing,
  applyMergeFieldChoices,
  buildMergeFieldDiff,
  canTransferDrawer,
  completenessScore,
  isValidMergeChoices,
} from './mergeFields';

const primary = {
  email: 'a@school.edu',
  phone: '111',
  gender: 'F',
  program: 'ESL',
  notes: '',
  fiscalYear: '2026',
  startDate: '2026-09-01',
  address: '1 Main St',
  apt: '',
  city: 'New York',
  state: 'NY',
  zip: '10001',
  addressValidationStatus: 'valid',
};

const secondary = {
  email: 'b@school.edu',
  phone: '222',
  gender: 'F',
  program: '',
  notes: 'Returning',
  fiscalYear: '2026',
  startDate: '2026-09-01',
  address: '9 Side Ave',
  apt: '2B',
  city: 'Bronx',
  state: 'NY',
  zip: '10451',
  addressValidationStatus: 'valid',
};

describe('buildMergeFieldDiff', () => {
  it('flags conflicts, same values, and fill-from-secondary', () => {
    const byKey = Object.fromEntries(
      buildMergeFieldDiff(primary, secondary).map((row) => [row.key, row]),
    );
    expect(byKey.email.status).toBe('conflict');
    expect(byKey.gender.status).toBe('same');
    expect(byKey.notes.status).toBe('only_secondary');
    expect(byKey.notes.defaultChoice).toBe('secondary');
    expect(byKey.program.status).toBe('only_primary');
    expect(byKey.addressGroup.status).toBe('conflict');
  });
});

describe('applyMergeFieldChoices', () => {
  it('copies only chosen secondary fields that actually change', () => {
    const { setFields, changes } = applyMergeFieldChoices(primary, secondary, {
      email: 'secondary',
      notes: 'secondary',
      addressGroup: 'secondary',
    });
    expect(setFields.email).toBe('b@school.edu');
    expect(setFields.notes).toBe('Returning');
    expect(setFields.phone).toBeUndefined();
    expect(setFields.address).toBe('9 Side Ave');
    expect(setFields.apt).toBe('2B');
    expect(changes.map((c) => c.field)).toContain('email');
  });

  it('skips empty secondary scalars even when chosen', () => {
    const { setFields } = applyMergeFieldChoices(primary, secondary, {
      program: 'secondary',
    });
    expect(setFields.program).toBeUndefined();
  });
});

describe('applyFillIfMissing', () => {
  it('fills empty primary fields from secondary only', () => {
    const { setFields } = applyFillIfMissing(primary, secondary);
    expect(setFields.notes).toBe('Returning');
    expect(setFields.email).toBeUndefined();
    expect(setFields.apt).toBe('2B');
  });
});

describe('isValidMergeChoices', () => {
  it('accepts known keys with primary/secondary values', () => {
    expect(isValidMergeChoices({ email: 'primary', addressGroup: 'secondary' })).toBe(true);
  });

  it('rejects extra keys or invalid sources', () => {
    expect(isValidMergeChoices({ email: 'both' })).toBe(false);
    expect(isValidMergeChoices({ cabinet: 'secondary' })).toBe(false);
    expect(isValidMergeChoices(null)).toBe(false);
  });
});

describe('completenessScore and canTransferDrawer', () => {
  it('scores filled contact fields', () => {
    const score = completenessScore(primary);
    expect(score.total).toBe(13);
    expect(score.filled).toBeGreaterThan(0);
    expect(score.pct).toBe(Math.round((score.filled / score.total) * 100));
  });

  it('allows drawer transfer only when primary has none and secondary has one', () => {
    expect(canTransferDrawer(
      { cabinet: '', drawer: '' },
      { cabinet: 'cab1', drawer: 'drw1' },
    )).toBe(true);
    expect(canTransferDrawer(
      { cabinet: 'cab1', drawer: 'drw1' },
      { cabinet: 'cab2', drawer: 'drw2' },
    )).toBe(false);
  });
});
