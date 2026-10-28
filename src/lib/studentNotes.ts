/**
 * Student notes — a per-student timeline of staff notes (e.g. "folder pulled for audit").
 * Stored in their own collection so a student can have any number of notes and the
 * Student Notes page can query across students. Deleted notes are hidden, not erased.
 */
import type { Db } from 'mongodb';

export const STUDENT_NOTES_COLLECTION = 'student_notes';

/** Roles that can read and write notes on a student. */
export const STUDENT_NOTE_ROLES = ['Admin', 'Data Lead', 'Data Member'] as const;

/** Roles that can open the cross-student Student Notes page. */
export const STUDENT_NOTES_PAGE_ROLES = ['Admin', 'Data Lead'] as const;

export const STUDENT_NOTE_MAX_LENGTH = 1000;

/** Authors can edit their own note for this long after saving it. */
export const STUDENT_NOTE_EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

export type NoteAuthor = {
  email: string;
  name?: string | null;
  role?: string | null;
};

export type StudentNoteDoc = {
  /** The student document _id (not the demographic studentId). */
  studentRef: string;
  school: string | null;
  body: string;
  createdBy: NoteAuthor;
  createdAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  deletedBy?: NoteAuthor | null;
};

/** Trim and validate note text. Returns the clean body or an error message. */
export function validateNoteBody(input: unknown): { body: string } | { error: string } {
  const body = typeof input === 'string' ? input.trim() : '';
  if (!body) return { error: 'Note cannot be empty' };
  if (body.length > STUDENT_NOTE_MAX_LENGTH) {
    return { error: `Note must be ${STUDENT_NOTE_MAX_LENGTH} characters or fewer` };
  }
  return { body };
}

function sameEmail(a?: string | null, b?: string | null): boolean {
  return Boolean(a && b && a.toLowerCase() === b.toLowerCase());
}

/** Only the author can edit, and only within 24 hours of creating the note. */
export function canEditNote(
  note: Pick<StudentNoteDoc, 'createdBy' | 'createdAt' | 'deletedAt'>,
  userEmail: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (note.deletedAt) return false;
  if (!sameEmail(note.createdBy?.email, userEmail)) return false;
  const created = Date.parse(note.createdAt);
  if (Number.isNaN(created)) return false;
  return now.getTime() - created <= STUDENT_NOTE_EDIT_WINDOW_MS;
}

/** The author or an Admin can delete (hide) a note at any time. */
export function canDeleteNote(
  note: Pick<StudentNoteDoc, 'createdBy' | 'deletedAt'>,
  userEmail: string | null | undefined,
  userRole: string | null | undefined,
): boolean {
  if (note.deletedAt) return false;
  return userRole === 'Admin' || sameEmail(note.createdBy?.email, userEmail);
}

let indexesReady: Promise<void> | null = null;

export async function ensureStudentNoteIndexes(db: Db): Promise<void> {
  if (!indexesReady) {
    indexesReady = (async () => {
      const col = db.collection(STUDENT_NOTES_COLLECTION);
      await Promise.all([
        col.createIndex({ studentRef: 1, createdAt: -1 }),
        col.createIndex({ school: 1, createdAt: -1 }),
      ]);
    })().catch((err) => {
      indexesReady = null;
      console.error('[studentNotes] index create failed', err);
    });
  }
  await indexesReady;
}

export type StudentNoteView = StudentNoteDoc & {
  _id: string;
  canEdit: boolean;
  canDelete: boolean;
};

/** Shape a stored note for the API, with what the current user may do with it. */
export function toStudentNoteView(
  doc: StudentNoteDoc & { _id: unknown },
  user: { email?: string | null; role?: string | null },
  now: Date = new Date(),
): StudentNoteView {
  return {
    _id: String(doc._id),
    studentRef: doc.studentRef,
    school: doc.school,
    body: doc.body,
    createdBy: doc.createdBy,
    createdAt: doc.createdAt,
    editedAt: doc.editedAt ?? null,
    canEdit: canEditNote(doc, user.email, now),
    canDelete: canDeleteNote(doc, user.email, user.role),
  };
}
