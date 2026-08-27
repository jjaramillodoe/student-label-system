import { describe, expect, it } from 'vitest';
import { ADMIN_SCAN_STUDENT_CAP, scanMeta } from './adminScan';

describe('adminScan', () => {
  it('exposes a finite cap and scan metadata', () => {
    expect(ADMIN_SCAN_STUDENT_CAP).toBeGreaterThan(0);
    expect(scanMeta({ truncated: true, scanned: 5000, cap: 5000 })).toEqual({
      scanned: 5000,
      truncated: true,
      cap: 5000,
    });
  });
});
