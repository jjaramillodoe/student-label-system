import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import clientPromise from '@/lib/mongodb';
import { formatFullName } from '@/lib/personName';

type CabinetDoc = {
  _id: any;
  name?: string;
  identifier?: string | null;
  school?: string;
  drawers?: {
    _id?: string;
    name?: string;
    capacity?: number;
    currentCount?: number;
  }[];
};

type StudentDoc = {
  _id: any;
  firstName?: string;
  lastName?: string;
  studentId?: string;
  dob?: string;
  fiscalYear?: string;
  status?: string;
  email?: string | null;
  school?: string;
  cabinet?: string;
  drawer?: string;
  archived?: boolean;
  archiveBoxId?: string;
  archiveBoxLabel?: string;
};

function isArchivedStudent(student: StudentDoc) {
  return student.archived === true || student.status === 'Archived';
}

function hasValidArchiveLocation(student: StudentDoc) {
  return Boolean(student.archiveBoxId || student.archiveBoxLabel);
}

function getCabinetName(cabinet: CabinetDoc) {
  return cabinet.identifier ? `${cabinet.name} (${cabinet.identifier})` : cabinet.name || 'Unnamed Cabinet';
}

function summarizeStudent(student: StudentDoc, issue: string, severity: 'error' | 'warning', cabinetName?: string, drawerName?: string) {
  return {
    _id: student._id.toString(),
    studentId: student.studentId || '',
    name: formatFullName(student) || 'Unnamed Student',
    dob: student.dob || '',
    fiscalYear: student.fiscalYear || '',
    status: student.status || '',
    email: student.email || '',
    school: student.school || '',
    cabinet: student.cabinet || '',
    drawer: student.drawer || '',
    cabinetName: cabinetName || '',
    drawerName: drawerName || '',
    issue,
    severity,
  };
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = session?.user?.role;
    const userSchool = session?.user?.school;

    if (!session || (userRole !== 'Admin' && userRole !== 'Data Lead')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const summaryOnly = searchParams.get('summaryOnly') === '1' || searchParams.get('summaryOnly') === 'true';

    const client = await clientPromise;
    const db = client.db('student-label');
    const scopedQuery = userRole !== 'Admin' && userSchool ? { school: userSchool } : {};

    const [students, cabinets] = await Promise.all([
      db.collection('students').find(scopedQuery).toArray() as Promise<StudentDoc[]>,
      db.collection('cabinets').find(scopedQuery).toArray() as Promise<CabinetDoc[]>,
    ]);

    const cabinetMap = new Map<string, CabinetDoc>();
    const drawerMap = new Map<string, { cabinet: CabinetDoc; drawer: NonNullable<CabinetDoc['drawers']>[number] }>();

    for (const cabinet of cabinets) {
      const cabinetId = cabinet._id.toString();
      cabinetMap.set(cabinetId, cabinet);

      for (const drawer of cabinet.drawers || []) {
        if (drawer._id) {
          drawerMap.set(`${cabinetId}:${drawer._id}`, { cabinet, drawer });
        }
      }
    }

    const queue = students.flatMap((student) => {
      if (isArchivedStudent(student) && hasValidArchiveLocation(student)) {
        return [];
      }

      const cabinetId = student.cabinet?.toString();
      const drawerId = student.drawer?.toString();

      if (isArchivedStudent(student)) {
        return [summarizeStudent(student, 'Archived but missing archive box', 'error')];
      }

      if (!cabinetId) {
        return [summarizeStudent(student, 'Missing cabinet', 'error')];
      }

      if (!drawerId) {
        return [summarizeStudent(student, 'Missing drawer', 'error')];
      }

      const cabinet = cabinetMap.get(cabinetId);
      if (!cabinet) {
        return [summarizeStudent(student, 'Assigned cabinet does not exist or is outside this school', 'error')];
      }

      const drawerEntry = drawerMap.get(`${cabinetId}:${drawerId}`);
      if (!drawerEntry) {
        return [summarizeStudent(student, 'Assigned drawer does not exist in cabinet', 'error', getCabinetName(cabinet))];
      }

      const currentCount = drawerEntry.drawer.currentCount || 0;
      const capacity = drawerEntry.drawer.capacity || 0;

      if (capacity > 0 && currentCount > capacity) {
        return [summarizeStudent(student, 'Assigned drawer is over capacity', 'warning', getCabinetName(cabinet), drawerEntry.drawer.name)];
      }

      if (capacity > 0 && currentCount === capacity) {
        return [summarizeStudent(student, 'Assigned drawer is full', 'warning', getCabinetName(cabinet), drawerEntry.drawer.name)];
      }

      return [];
    });

    const summary = queue.reduce(
      (counts, item) => {
        counts.total += 1;
        if (item.severity === 'error') counts.errors += 1;
        if (item.severity === 'warning') counts.warnings += 1;
        counts.byIssue[item.issue] = (counts.byIssue[item.issue] || 0) + 1;
        return counts;
      },
      { total: 0, errors: 0, warnings: 0, byIssue: {} as Record<string, number> }
    );

    return NextResponse.json({
      summary,
      ...(summaryOnly
        ? {}
        : {
            students: queue.sort((a, b) => a.issue.localeCompare(b.issue) || a.name.localeCompare(b.name)),
          }),
    });
  } catch (error) {
    console.error('Error fetching unassigned student queue:', error);
    return NextResponse.json({ error: 'Failed to fetch unassigned student queue' }, { status: 500 });
  }
}
