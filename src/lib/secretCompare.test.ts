import { describe, expect, it } from 'vitest';
import {
  extractBearerToken,
  isAuthorizedBySharedSecret,
  timingSafeEqualString,
} from './secretCompare';

describe('extractBearerToken', () => {
  it('reads a Bearer token and ignores other schemes', () => {
    expect(extractBearerToken('Bearer abc')).toBe('abc');
    expect(extractBearerToken('bearer abc')).toBeNull();
    expect(extractBearerToken('Basic abc')).toBeNull();
    expect(extractBearerToken('Bearer ')).toBeNull();
  });
});

describe('timingSafeEqualString', () => {
  it('compares exact strings', () => {
    expect(timingSafeEqualString('secret', 'secret')).toBe(true);
    expect(timingSafeEqualString('secret', 'Secret')).toBe(false);
    expect(timingSafeEqualString('ab', 'abc')).toBe(false);
  });
});

describe('isAuthorizedBySharedSecret', () => {
  it('requires a configured secret and matching Bearer token', () => {
    expect(isAuthorizedBySharedSecret('Bearer s3cret', 's3cret')).toBe(true);
    expect(isAuthorizedBySharedSecret('Bearer nope', 's3cret')).toBe(false);
    expect(isAuthorizedBySharedSecret('Bearer s3cret', '')).toBe(false);
    expect(isAuthorizedBySharedSecret(null, 's3cret')).toBe(false);
  });
});
