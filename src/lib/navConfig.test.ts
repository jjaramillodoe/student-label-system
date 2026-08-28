import { describe, expect, it } from 'vitest';
import { shouldUseAppShell } from './navConfig';

describe('shouldUseAppShell', () => {
  it('uses the dashboard shell on intake for staff, not Intake Members', () => {
    expect(shouldUseAppShell('/intake', 'Data Member')).toBe(true);
    expect(shouldUseAppShell('/intake', 'Admin')).toBe(true);
    expect(shouldUseAppShell('/intake', 'Intake Member')).toBe(false);
  });

  it('keeps public and auth routes out of the shell', () => {
    expect(shouldUseAppShell('/auth/signin', 'Admin')).toBe(false);
    expect(shouldUseAppShell('/student/abc', 'Admin')).toBe(false);
    expect(shouldUseAppShell('/', 'Data Member')).toBe(true);
  });
});
