/** Staff roles that may read or update a student record (school-scoped except Admin). */
export const STUDENT_READ_ROLES = ['Admin', 'Data Lead', 'Data Member', 'Intake Member'] as const;
export const STUDENT_WRITE_ROLES = ['Admin', 'Data Lead', 'Data Member', 'Intake Member'] as const;
export const STUDENT_DELETE_ROLES = ['Admin', 'Data Lead'] as const;
/** Label generation is staff-only — Intake Member reprints go through Data Lead / Member. */
export const STUDENT_PRINT_ROLES = ['Admin', 'Data Lead', 'Data Member'] as const;

export type StudentAccessAction = 'read' | 'update' | 'delete';

const ROLE_SETS: Record<StudentAccessAction, readonly string[]> = {
  read: STUDENT_READ_ROLES,
  update: STUDENT_WRITE_ROLES,
  delete: STUDENT_DELETE_ROLES,
};

export type StudentAccessOk = { ok: true };
export type StudentAccessDenied = { ok: false; status: 401 | 403 | 404; error: string };
export type StudentAccessResult = StudentAccessOk | StudentAccessDenied;

function sameSchool(userSchool?: string | null, studentSchool?: string | null): boolean {
  if (!userSchool || !studentSchool) return false;
  return userSchool === studentSchool;
}

/**
 * Authorize access to a student-by-id record.
 * Cross-school misses return 404 so ObjectIds in other schools are not enumerable.
 */
export function authorizeStudentAccess(opts: {
  role?: string | null;
  userSchool?: string | null;
  action: StudentAccessAction;
  studentSchool?: string | null;
  studentExists: boolean;
}): StudentAccessResult {
  const { role, userSchool, action, studentSchool, studentExists } = opts;

  if (!role) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  if (!ROLE_SETS[action].includes(role)) {
    return { ok: false, status: 403, error: 'Forbidden — Insufficient role' };
  }

  if (!studentExists) {
    return { ok: false, status: 404, error: 'Student not found' };
  }

  if (role === 'Admin') {
    return { ok: true };
  }

  if (!userSchool) {
    return { ok: false, status: 403, error: 'Forbidden — No school assigned' };
  }

  if (!sameSchool(userSchool, studentSchool)) {
    return { ok: false, status: 404, error: 'Student not found' };
  }

  return { ok: true };
}

/**
 * Non-admins cannot reassign a student to a different school on PUT.
 * Omitting school, or sending the current school, is allowed.
 */
export function authorizeStudentSchoolChange(opts: {
  role?: string | null;
  currentSchool?: string | null;
  requestedSchool?: unknown;
}): StudentAccessResult {
  const { role, currentSchool, requestedSchool } = opts;
  if (requestedSchool == null) return { ok: true };
  if (role === 'Admin') return { ok: true };
  if (requestedSchool === currentSchool) return { ok: true };
  return { ok: false, status: 403, error: 'Forbidden — cannot move a student to another school' };
}

/**
 * Avery / label print: Intake Member is always 403 even for same-school records.
 */
export function authorizeStudentPrintAccess(opts: {
  role?: string | null;
  userSchool?: string | null;
  studentSchool?: string | null;
  studentExists: boolean;
}): StudentAccessResult {
  const { role } = opts;
  if (!role) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  if (!(STUDENT_PRINT_ROLES as readonly string[]).includes(role)) {
    return {
      ok: false,
      status: 403,
      error: role === 'Intake Member'
        ? 'Forbidden — Intake Member cannot print labels'
        : 'Forbidden — Insufficient role',
    };
  }
  return authorizeStudentAccess({ ...opts, action: 'read' });
}
