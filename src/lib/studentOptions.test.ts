import { describe, expect, it } from 'vitest';
import { STUDENT_STATUS_OPTIONS, isStudentStatus } from './studentOptions';

describe('studentOptions', () => {
  it('includes statuses that EditStudentModal previously omitted', () => {
    expect(STUDENT_STATUS_OPTIONS).toContain('Withdrawn');
    expect(STUDENT_STATUS_OPTIONS).toContain('Pending');
    expect(STUDENT_STATUS_OPTIONS).toContain('Archived');
    expect(isStudentStatus('Active')).toBe(true);
    expect(isStudentStatus('Nope')).toBe(false);
  });
});
