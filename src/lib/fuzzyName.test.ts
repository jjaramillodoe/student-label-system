import { describe, expect, it } from 'vitest';
import {
  MIN_INTAKE_REVIEW_MATCH_PERCENT,
  matchPercent,
  shouldReviewSameDobMatch,
} from './fuzzyName';

describe('shouldReviewSameDobMatch', () => {
  const dob = '1990-04-22';

  it('hides coincidental same-birthday hits with very low name similarity', () => {
    const incoming = { firstName: 'Marco', lastName: 'Gomez', dob };
    const existing = { firstName: 'Shirley', lastName: 'Alarcon', dob };
    const pct = matchPercent(incoming, existing);
    expect(pct).toBeLessThan(MIN_INTAKE_REVIEW_MATCH_PERCENT);
    expect(shouldReviewSameDobMatch(incoming, existing, { similarityPercent: pct })).toBe(false);
  });

  it('keeps same last name + same DOB as possible siblings', () => {
    expect(shouldReviewSameDobMatch(
      { firstName: 'Marco', lastName: 'Gomez', dob },
      { firstName: 'Luis', lastName: 'Gomez', dob },
    )).toBe(true);
  });

  it('keeps a close name duplicate even when first names are not identical', () => {
    expect(shouldReviewSameDobMatch(
      { firstName: 'Javier', lastName: 'Jaramillo', dob },
      { firstName: 'Javier Ernesto', lastName: 'Jaramillo', dob },
    )).toBe(true);
  });

  it('keeps a same-address match even when names differ', () => {
    expect(shouldReviewSameDobMatch(
      { firstName: 'Marco', lastName: 'Gomez', dob },
      { firstName: 'Shirley', lastName: 'Alarcon', dob },
      { sameAddress: true, similarityPercent: 7 },
    )).toBe(true);
  });
});
