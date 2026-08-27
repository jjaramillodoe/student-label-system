import { ObjectId, type Db } from 'mongodb';
import { authorizeStudentPrintAccess } from '@/lib/studentAccess';
import { normalizeMongoId } from '@/lib/utils';

export const PRINT_MAX_STUDENTS = 500;

export type PrintLabelStudent = {
  _id: string;
  firstName?: string;
  lastName?: string;
  dob?: string;
  labelId?: string;
  studentId?: string;
  school?: string;
  cabinet?: string;
  drawer?: string;
};

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

function asObjectIdString(value: unknown): string | null {
  const id = typeof value === 'string' ? value.trim() : normalizeMongoId(value);
  if (!id || !OBJECT_ID_RE.test(id)) return null;
  return id;
}

/**
 * Accept `ids: string[]`. Legacy `students: [{ _id }]` is allowed but only `_id`
 * is read — name/DOB/label fields from the client are ignored.
 */
export function parsePrintStudentIds(body: unknown):
  | { ok: true; ids: string[]; skipStock: boolean }
  | { ok: false; status: 400; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, status: 400, error: 'Invalid body' };
  }
  const raw = body as Record<string, unknown>;
  const skipStock = raw.skipStock === true;

  let values: unknown[] = [];
  if (Array.isArray(raw.ids)) {
    values = raw.ids;
  } else if (Array.isArray(raw.students)) {
    values = raw.students.map((row) => (
      row && typeof row === 'object' ? (row as { _id?: unknown })._id : null
    ));
  }

  const ids: string[] = [];
  for (const value of values) {
    const id = asObjectIdString(value);
    if (!id) {
      return { ok: false, status: 400, error: 'Invalid student ID format' };
    }
    ids.push(id);
  }

  if (ids.length === 0) {
    return { ok: false, status: 400, error: 'No students provided' };
  }
  if (ids.length > PRINT_MAX_STUDENTS) {
    return { ok: false, status: 400, error: `Too many students (max ${PRINT_MAX_STUDENTS})` };
  }
  return { ok: true, ids, skipStock };
}

export function toPrintLabelStudent(doc: Record<string, unknown>): PrintLabelStudent {
  return {
    _id: asObjectIdString(doc._id) ?? String(doc._id),
    firstName: typeof doc.firstName === 'string' ? doc.firstName : undefined,
    lastName: typeof doc.lastName === 'string' ? doc.lastName : undefined,
    dob: typeof doc.dob === 'string' ? doc.dob : undefined,
    labelId: typeof doc.labelId === 'string' ? doc.labelId : undefined,
    studentId: typeof doc.studentId === 'string' ? doc.studentId : undefined,
    school: typeof doc.school === 'string' ? doc.school : undefined,
    cabinet: typeof doc.cabinet === 'string' ? doc.cabinet : undefined,
    drawer: typeof doc.drawer === 'string' ? doc.drawer : undefined,
  };
}

export async function loadAuthorizedPrintStudents(
  db: Db,
  ids: string[],
  session: { role?: string | null; school?: string | null },
): Promise<
  | { ok: true; students: PrintLabelStudent[] }
  | { ok: false; status: 401 | 403 | 404; error: string }
> {
  const roleGate = authorizeStudentPrintAccess({
    role: session.role,
    userSchool: session.school,
    studentExists: true,
    studentSchool: session.school ?? '',
  });
  if (!roleGate.ok) return roleGate;

  const docs = await db.collection('students').find({
    _id: { $in: ids.map((id) => new ObjectId(id)) },
  }).toArray();
  const byId = new Map(docs.map((doc) => [String(doc._id), doc]));

  const students: PrintLabelStudent[] = [];
  for (const id of ids) {
    const doc = byId.get(id);
    const access = authorizeStudentPrintAccess({
      role: session.role,
      userSchool: session.school,
      studentExists: Boolean(doc),
      studentSchool: typeof doc?.school === 'string' ? doc.school : null,
    });
    if (!access.ok) return access;
    students.push(toPrintLabelStudent(doc as Record<string, unknown>));
  }
  return { ok: true, students };
}
