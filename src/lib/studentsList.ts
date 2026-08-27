export const STUDENTS_LIST_DEFAULT_LIMIT = 50;
export const STUDENTS_LIST_SEARCH_LIMIT = 20;
export const STUDENTS_LIST_MAX_LIMIT = 500;
export const STUDENTS_LIST_CSV_MAX = 5000;

export type StudentsListResponse<T = Record<string, unknown>> = {
  students: T[];
  total: number;
  page: number;
  limit: number;
};

export function clampStudentsListLimit(raw: number, fallback = STUDENTS_LIST_DEFAULT_LIMIT): number {
  if (!Number.isFinite(raw) || raw < 1) return fallback;
  return Math.min(Math.max(1, Math.floor(raw)), STUDENTS_LIST_MAX_LIMIT);
}

export function parseStudentsListResponse<T = Record<string, unknown>>(data: unknown): StudentsListResponse<T> {
  if (Array.isArray(data)) {
    return { students: data as T[], total: data.length, page: 1, limit: data.length };
  }
  if (data && typeof data === 'object' && Array.isArray((data as { students?: unknown }).students)) {
    const d = data as { students: T[]; total?: number; page?: number; limit?: number };
    return {
      students: d.students,
      total: typeof d.total === 'number' ? d.total : d.students.length,
      page: typeof d.page === 'number' ? d.page : 1,
      limit: typeof d.limit === 'number' ? d.limit : d.students.length,
    };
  }
  return { students: [], total: 0, page: 1, limit: 0 };
}

/** Load every page (admin tools that still need a full in-memory set). */
export async function fetchAllStudentPages<T = Record<string, unknown>>(
  extraParams?: URLSearchParams,
): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  while (page <= 50) {
    const params = new URLSearchParams(extraParams);
    params.set('page', String(page));
    params.set('limit', String(STUDENTS_LIST_MAX_LIMIT));
    const res = await fetch(`/api/students?${params.toString()}`);
    if (!res.ok) break;
    const parsed = parseStudentsListResponse<T>(await res.json());
    all.push(...parsed.students);
    if (all.length >= parsed.total || parsed.students.length === 0) break;
    page += 1;
  }
  return all;
}
