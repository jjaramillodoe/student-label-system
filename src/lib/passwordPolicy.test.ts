import { describe, expect, it } from 'vitest';
import { passwordPolicyError } from './passwordPolicy';

describe('passwordPolicyError', () => {
  it('rejects short or simple passwords', () => {
    expect(passwordPolicyError('short1A')).toBeTruthy();
    expect(passwordPolicyError('abcdefghij')).toBeTruthy();
    expect(passwordPolicyError('1234567890')).toBeTruthy();
  });

  it('accepts a letter + number password of length 10+', () => {
    expect(passwordPolicyError('abcde12345')).toBeNull();
  });
});
