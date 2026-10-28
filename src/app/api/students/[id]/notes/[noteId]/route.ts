import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { requireRole, type SessionUser } from '@/lib/requireSession';
import clientPromise from '@/lib/mongodb';
import {
  STUDENT_NOTES_COLLECTION,
  STUDENT_NOTE_ROLES,
  canDeleteNote,
  canEditNote,
  toStudentNoteView,
  validateNoteBody,
  type StudentNoteDoc,
} from '@/lib/studentNotes';

async function loadNote(id: string, noteId: string, user: SessionUser) {
  if (!ObjectId.isValid(id) || !ObjectId.isValid(noteId)) {
    return { error: NextResponse.json({ error: 'Invalid ID' }, { status: 400 }) } as const;
  }
  const client = await clientPromise;
  const db = client.db('student-label');
  const note = await db.collection<StudentNoteDoc>(STUDENT_NOTES_COLLECTION).findOne({
    _id: new ObjectId(noteId),
    studentRef: id,
    deletedAt: null,
  });
  if (!note) {
    return { error: NextResponse.json({ error: 'Note not found' }, { status: 404 }) } as const;
  }
  if (user.role !== 'Admin' && user.school && note.school !== user.school) {
    return { error: NextResponse.json({ error: 'Forbidden — note is outside your school' }, { status: 403 }) } as const;
  }
  return { db, note } as const;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> },
) {
  const auth = await requireRole(STUDENT_NOTE_ROLES);
  if (!auth.ok) return auth.response;

  const { id, noteId } = await params;
  const loaded = await loadNote(id, noteId, auth.user);
  if ('error' in loaded) return loaded.error;
  const { db, note } = loaded;

  if (!canEditNote(note, auth.user.email)) {
    return NextResponse.json(
      { error: 'Only the author can edit a note, within 24 hours of saving it' },
      { status: 403 },
    );
  }

  const payload = await req.json().catch(() => ({})) as { body?: unknown };
  const validated = validateNoteBody(payload.body);
  if ('error' in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const now = new Date().toISOString();
  await db.collection<StudentNoteDoc>(STUDENT_NOTES_COLLECTION).updateOne(
    { _id: note._id },
    { $set: { body: validated.body, editedAt: now } },
  );
  await db.collection('audit_logs').insertOne({
    action: 'Edit Student Note',
    student: [{ _id: id }],
    noteId,
    previousBody: note.body,
    time: now,
    user: { name: auth.user.name, email: auth.user.email, role: auth.user.role, school: auth.user.school },
  });

  return NextResponse.json({
    note: toStudentNoteView({ ...note, body: validated.body, editedAt: now }, auth.user),
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> },
) {
  const auth = await requireRole(STUDENT_NOTE_ROLES);
  if (!auth.ok) return auth.response;

  const { id, noteId } = await params;
  const loaded = await loadNote(id, noteId, auth.user);
  if ('error' in loaded) return loaded.error;
  const { db, note } = loaded;

  if (!canDeleteNote(note, auth.user.email, auth.user.role)) {
    return NextResponse.json(
      { error: 'Only the author or an Admin can delete a note' },
      { status: 403 },
    );
  }

  const now = new Date().toISOString();
  const actor = { email: auth.user.email || '', name: auth.user.name ?? null, role: auth.user.role };
  // Hide rather than erase, so the audit trail keeps the original text.
  await db.collection<StudentNoteDoc>(STUDENT_NOTES_COLLECTION).updateOne(
    { _id: note._id },
    { $set: { deletedAt: now, deletedBy: actor } },
  );

  const latest = await db.collection<StudentNoteDoc>(STUDENT_NOTES_COLLECTION).findOne(
    { studentRef: id, deletedAt: null },
    { sort: { createdAt: -1 }, projection: { createdAt: 1 } },
  );
  await Promise.all([
    db.collection('students').updateOne(
      { _id: new ObjectId(id) },
      { $inc: { noteCount: -1 }, $set: { lastNoteAt: latest?.createdAt ?? null } },
    ),
    db.collection('audit_logs').insertOne({
      action: 'Delete Student Note',
      student: [{ _id: id }],
      noteId,
      time: now,
      user: { ...actor, school: auth.user.school },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
