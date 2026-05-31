import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import clientPromise from '@/lib/mongodb';

type StudentDoc = {
  _id: any;
  firstName?: string;
  lastName?: string;
  dob?: string;
  email?: string | null;
  studentId?: string;
  fiscalYear?: string;
  status?: string;
  school?: string;
  cabinet?: string;
  drawer?: string;
};

type DuplicateGroup = {
  key: string;
  label: string;
  students: ReturnType<typeof summarizeStudent>[];
};

function normalize(value?: string | null) {
  return (value || '').trim().toLowerCase();
}

function summarizeStudent(student: StudentDoc) {
  return {
    _id: student._id.toString(),
    studentId: student.studentId || '',
    name: `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Unnamed Student',
    firstName: student.firstName || '',
    lastName: student.lastName || '',
    dob: student.dob || '',
    email: student.email || '',
    fiscalYear: student.fiscalYear || '',
    status: student.status || '',
    school: student.school || '',
    cabinet: student.cabinet || '',
    drawer: student.drawer || '',
  };
}

function addToGroup(map: Map<string, StudentDoc[]>, key: string, student: StudentDoc) {
  if (!key) return;
  const current = map.get(key) || [];
  current.push(student);
  map.set(key, current);
}

function toDuplicateGroups(map: Map<string, StudentDoc[]>, labelFor: (key: string) => string): DuplicateGroup[] {
  return Array.from(map.entries())
    .filter(([, students]) => students.length > 1)
    .map(([key, students]) => ({
      key,
      label: labelFor(key),
      students: students.map(summarizeStudent),
    }))
    .sort((a, b) => b.students.length - a.students.length || a.label.localeCompare(b.label));
}

function getStudentIdPrefix(studentId?: string) {
  const value = (studentId || '').trim().toUpperCase();
  const match = value.match(/^(\d{4}-[A-Z]{2})-/);
  return match?.[1] || '';
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userRole = session?.user?.role;
    const userSchool = session?.user?.school;

    if (!session || (userRole !== 'Admin' && userRole !== 'Data Lead')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const client = await clientPromise;
    const db = client.db('student-label');
    const scopedQuery = userRole !== 'Admin' && userSchool ? { school: userSchool } : {};
    const students = await db.collection('students').find(scopedQuery).toArray() as StudentDoc[];

    const byNameDob = new Map<string, StudentDoc[]>();
    const byEmail = new Map<string, StudentDoc[]>();
    const byStudentId = new Map<string, StudentDoc[]>();
    const bySimilarStudentId = new Map<string, StudentDoc[]>();

    for (const student of students) {
      const nameDobKey = [
        normalize(student.firstName),
        normalize(student.lastName),
        normalize(student.dob),
      ].join('|');

      if (student.firstName && student.lastName && student.dob) {
        addToGroup(byNameDob, nameDobKey, student);
      }

      if (student.email) {
        addToGroup(byEmail, normalize(student.email), student);
      }

      if (student.studentId) {
        addToGroup(byStudentId, normalize(student.studentId), student);
        addToGroup(bySimilarStudentId, getStudentIdPrefix(student.studentId), student);
      }
    }

    const exactStudentIdGroups = toDuplicateGroups(byStudentId, key => key.toUpperCase());

    return NextResponse.json({
      summary: {
        students: students.length,
        nameDobGroups: toDuplicateGroups(byNameDob, key => key.split('|').filter(Boolean).join(' / ')).length,
        emailGroups: toDuplicateGroups(byEmail, key => key).length,
        exactStudentIdGroups: exactStudentIdGroups.length,
        similarStudentIdGroups: toDuplicateGroups(bySimilarStudentId, key => `${key}-XXXXXXX`).length,
      },
      nameDobGroups: toDuplicateGroups(byNameDob, key => {
        const [firstName, lastName, dob] = key.split('|');
        return `${firstName} ${lastName} / ${dob}`;
      }),
      emailGroups: toDuplicateGroups(byEmail, key => key),
      exactStudentIdGroups,
      similarStudentIdGroups: toDuplicateGroups(bySimilarStudentId, key => `${key}-XXXXXXX`),
    });
  } catch (error) {
    console.error('Error detecting duplicate students:', error);
    return NextResponse.json({ error: 'Failed to detect duplicate students' }, { status: 500 });
  }
}
