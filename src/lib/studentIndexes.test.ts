import { describe, expect, it } from 'vitest';
import { STUDENT_INDEX_SPECS } from './studentIndexes';

describe('STUDENT_INDEX_SPECS', () => {
  it('includes school+archived and unique sparse ID indexes', () => {
    const names = STUDENT_INDEX_SPECS.map((s) => s.name);
    expect(names).toContain('school_archived');
    expect(names).toContain('sync_studentId');
    expect(names).toContain('labelId_unique_sparse');

    const studentId = STUDENT_INDEX_SPECS.find((s) => s.name === 'sync_studentId');
    expect(studentId?.options.unique).toBe(true);
    expect(studentId?.options.sparse).toBe(true);

    const labelId = STUDENT_INDEX_SPECS.find((s) => s.name === 'labelId_unique_sparse');
    expect(labelId?.options.unique).toBe(true);
    expect(labelId?.options.sparse).toBe(true);
  });
});
