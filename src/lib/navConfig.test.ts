import { describe, expect, it } from 'vitest';
import { shouldUseAppShell, isNavItemVisible, NAV_GROUPS } from './navConfig';

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

  it('shows Generate ISRF to staff and hides it from Intake Members', () => {
    const item = NAV_GROUPS.flatMap((g) => g.items).find((i) => i.href === '/admin/isrf');
    expect(item).toBeTruthy();
    expect(isNavItemVisible(item!, 'Admin')).toBe(true);
    expect(isNavItemVisible(item!, 'Data Lead')).toBe(true);
    expect(isNavItemVisible(item!, 'Data Member')).toBe(true);
    expect(isNavItemVisible(item!, 'Intake Member')).toBe(false);
  });
});
