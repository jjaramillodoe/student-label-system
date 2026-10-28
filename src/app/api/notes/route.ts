import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { requireRole } from '@/lib/requireSession';
import clientPromise from '@/lib/mongodb';
import {
  STUDENT_NOTES_COLLECTION,
  STUDENT_NOTES_PAGE_ROLES,
  type StudentNoteDoc,
} from '@/lib/studentNotes';

const MAX_STUDENTS = 200;

/**
 * Students that have notes, newest activity first, with each student's latest note.
 * Optional `days` limits to students noted in the last N days; `mine=1` to notes I wrote.
 */
export async function GET(req: NextRequest) {
  const auth = await requireRole(STUDENT_NOTES_PAGE_ROLES);
  if (!auth.ok) return auth.response;

  const searchParams = req.nextUrl.searchParams;
  const days = parseInt(searchParams.get('days') || '', 10);
  const mine = searchParams.get('mine') === '1';

  const match: Record<string, unknown> = { deletedAt: null };
  if (auth.user.role !== 'Admin' && auth.user.school) match.school = auth.user.school;
  if (Number.isFinite(days) && days > 0) {
    match.createdAt = { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString() };
  }
  if (mine && auth.user.email) match['createdBy.email'] = auth.user.email;

  const client = await clientPromise;
  const db = client.db('student-label');
  const groups = await db.collection<StudentNoteDoc>(STUDENT_NOTES_COLLECTION).aggregate<{
    _id: string;
    noteCount: number;
    latest: StudentNoteDoc & { _id: ObjectId };
  }>([
    { $match: match },
    { $sort: { createdAt: -1 } },
    { $group: { _id: '$studentRef', noteCount: { $sum: 1 }, latest: { $first: '$$ROOT' } } },
    { $sort: { 'latest.createdAt': -1 } },
    { $limit: MAX_STUDENTS },
  ]).toArray();

  const ids = groups.map((g) => g._id).filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
  const students = await db.collection('students')
    .find({ _id: { $in: ids } })
    .project({ firstName: 1, lastName: 1, dob: 1, labelId: 1, studentId: 1, school: 1, status: 1, archived: 1 })
    .toArray();
  const byId = new Map(students.map((s) => [String(s._id), s]));

  return NextResponse.json({
    students: groups
      .filter((g) => byId.has(g._id))
      .map((g) => ({
        student: { ...byId.get(g._id), _id: g._id },
        noteCount: g.noteCount,
        latest: {
          _id: String(g.latest._id),
          body: g.latest.body,
          createdAt: g.latest.createdAt,
          createdBy: g.latest.createdBy,
        },
      })),
    truncated: groups.length >= MAX_STUDENTS,
  });
}
