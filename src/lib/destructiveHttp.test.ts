import { afterEach, describe, expect, it } from 'vitest';
import { isDestructiveHttpBlocked } from './destructiveHttp';

const ORIGINAL = {
  VERCEL_ENV: process.env.VERCEL_ENV,
  ALLOW_DESTRUCTIVE_HTTP: process.env.ALLOW_DESTRUCTIVE_HTTP,
};

afterEach(() => {
  if (ORIGINAL.VERCEL_ENV === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = ORIGINAL.VERCEL_ENV;
  if (ORIGINAL.ALLOW_DESTRUCTIVE_HTTP === undefined) delete process.env.ALLOW_DESTRUCTIVE_HTTP;
  else process.env.ALLOW_DESTRUCTIVE_HTTP = ORIGINAL.ALLOW_DESTRUCTIVE_HTTP;
});

describe('isDestructiveHttpBlocked', () => {
  it('blocks Vercel production', () => {
    process.env.VERCEL_ENV = 'production';
    delete process.env.ALLOW_DESTRUCTIVE_HTTP;
    expect(isDestructiveHttpBlocked()).toBe(true);
  });

  it('allows preview and development', () => {
    process.env.VERCEL_ENV = 'preview';
    expect(isDestructiveHttpBlocked()).toBe(false);
    process.env.VERCEL_ENV = 'development';
    expect(isDestructiveHttpBlocked()).toBe(false);
  });

  it('honors ALLOW_DESTRUCTIVE_HTTP', () => {
    process.env.VERCEL_ENV = 'production';
    process.env.ALLOW_DESTRUCTIVE_HTTP = '1';
    expect(isDestructiveHttpBlocked()).toBe(false);
  });
});
