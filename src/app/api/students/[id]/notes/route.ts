import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { requireRole } from '@/lib/requireSession';
import clientPromise from '@/lib/mongodb';
import {
  STUDENT_NOTES_COLLECTION,
  STUDENT_NOTE_ROLES,
  ensureStudentNoteIndexes,
  toStudentNoteView,
  validateNoteBody,
  type StudentNoteDoc,
} from '@/lib/studentNotes';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole(STUDENT_NOTE_ROLES);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid student ID' }, { status: 400 });
  }

  const client = await clientPromise;
  const db = client.db('student-label');
  const student = await db.collection('students').findOne(
    { _id: new ObjectId(id) },
    { projection: { school: 1 } },
  );
  if (!student) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 });
  }
  if (auth.user.role !== 'Admin' && auth.user.school && student.school !== auth.user.school) {
    return NextResponse.json({ error: 'Forbidden — student is outside your school' }, { status: 403 });
  }

  const docs = await db.collection<StudentNoteDoc>(STUDENT_NOTES_COLLECTION)
    .find({ studentRef: id, deletedAt: null })
    .sort({ createdAt: -1 })
    .limit(500)
    .toArray();

  const now = new Date();
  return NextResponse.json({ notes: docs.map((doc) => toStudentNoteView(doc, auth.user, now)) });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole(STUDENT_NOTE_ROLES);
  if (!auth.ok) return auth.response;
  if (!auth.user.email) {
    return NextResponse.json({ error: 'Your account has no email on file' }, { status: 400 });
  }

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid student ID' }, { status: 400 });
  }

  const payload = await req.json().catch(() => ({})) as { body?: unknown };
  const validated = validateNoteBody(payload.body);
  if ('error' in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const client = await clientPromise;
  const db = client.db('student-label');
  const student = await db.collection('students').findOne(
    { _id: new ObjectId(id) },
    { projection: { school: 1, firstName: 1, lastName: 1, studentId: 1 } },
  );
  if (!student) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 });
  }
  if (auth.user.role !== 'Admin' && auth.user.school && student.school !== auth.user.school) {
    return NextResponse.json({ error: 'Forbidden — student is outside your school' }, { status: 403 });
  }

  await ensureStudentNoteIndexes(db);
  const now = new Date().toISOString();
  const author = { email: auth.user.email, name: auth.user.name ?? null, role: auth.user.role };
  const doc: StudentNoteDoc = {
    studentRef: id,
    school: typeof student.school === 'string' ? student.school : null,
    body: validated.body,
    createdBy: author,
    createdAt: now,
    editedAt: null,
    deletedAt: null,
  };
  const insert = await db.collection<StudentNoteDoc>(STUDENT_NOTES_COLLECTION).insertOne(doc);

  await Promise.all([
    db.collection('students').updateOne(
      { _id: new ObjectId(id) },
      { $inc: { noteCount: 1 }, $set: { lastNoteAt: now } },
    ),
    db.collection('audit_logs').insertOne({
      action: 'Add Student Note',
      student: [{ _id: id, studentId: student.studentId, firstName: student.firstName, lastName: student.lastName }],
      noteId: String(insert.insertedId),
      time: now,
      user: { ...author, school: auth.user.school },
    }),
  ]);

  return NextResponse.json(
    { note: toStudentNoteView({ ...doc, _id: insert.insertedId }, auth.user) },
    { status: 201 },
  );
}
