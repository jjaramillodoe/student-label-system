import { describe, expect, it } from 'vitest';
import {
  STUDENTS_LIST_MAX_LIMIT,
  clampStudentsListLimit,
  parseStudentsListResponse,
} from './studentsList';

describe('clampStudentsListLimit', () => {
  it('caps at the max and floors invalid values to the fallback', () => {
    expect(clampStudentsListLimit(10)).toBe(10);
    expect(clampStudentsListLimit(9999)).toBe(STUDENTS_LIST_MAX_LIMIT);
    expect(clampStudentsListLimit(0)).toBe(50);
    expect(clampStudentsListLimit(Number.NaN)).toBe(50);
  });
});

describe('parseStudentsListResponse', () => {
  it('reads the paginated envelope', () => {
    const parsed = parseStudentsListResponse({
      students: [{ firstName: 'Ada' }],
      total: 41,
      page: 2,
      limit: 10,
    });
    expect(parsed.total).toBe(41);
    expect(parsed.page).toBe(2);
    expect(parsed.students).toHaveLength(1);
  });

  it('accepts a legacy array payload', () => {
    const parsed = parseStudentsListResponse([{ firstName: 'Ada' }, { firstName: 'Alan' }]);
    expect(parsed.total).toBe(2);
    expect(parsed.students).toHaveLength(2);
  });
});
