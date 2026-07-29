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
  status?: string;
  totalCapacity?: number;
  currentCount?: number;
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
  cabinet?: string;
  drawer?: string;
  school?: string;
  archived?: boolean;
  status?: string;
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

function isArchivedCabinet(cabinet: CabinetDoc) {
  return cabinet.status === 'Archived';
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

    const [cabinets, students] = await Promise.all([
      db.collection('cabinets').find(scopedQuery).toArray() as Promise<CabinetDoc[]>,
      db.collection('students').find(scopedQuery).toArray() as Promise<StudentDoc[]>,
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

    const activeCabinets = cabinets.filter(cabinet => !isArchivedCabinet(cabinet));
    const archivedCabinetCount = cabinets.length - activeCabinets.length;

    const fullDrawers: any[] = [];
    const nearFullDrawers: any[] = [];
    const emptyDrawers: any[] = [];
    const overCapacityCabinets: any[] = [];
    const badAssignments: any[] = [];

    for (const cabinet of activeCabinets) {
      const cabinetId = cabinet._id.toString();
      const cabinetName = getCabinetName(cabinet);
      const totalCapacity = cabinet.totalCapacity || 0;
      const currentCount = cabinet.currentCount || 0;
      const cabinetUsagePercent = totalCapacity > 0 ? Math.round((currentCount / totalCapacity) * 100) : 0;

      if (currentCount > totalCapacity) {
        overCapacityCabinets.push({
          cabinetId,
          cabinetName,
          school: cabinet.school,
          currentCount,
          totalCapacity,
          overBy: currentCount - totalCapacity,
          usagePercent: cabinetUsagePercent,
        });
      }

      for (const drawer of cabinet.drawers || []) {
        const capacity = drawer.capacity || 0;
        const drawerCount = drawer.currentCount || 0;
        const usagePercent = capacity > 0 ? Math.round((drawerCount / capacity) * 100) : 0;
        const drawerHealth = {
          cabinetId,
          cabinetName,
          school: cabinet.school,
          drawerId: drawer._id,
          drawerName: drawer.name || 'Unnamed Drawer',
          currentCount: drawerCount,
          capacity,
          usagePercent,
          available: capacity - drawerCount,
        };

        if (drawerCount === 0) {
          emptyDrawers.push(drawerHealth);
        } else if (usagePercent >= 100) {
          fullDrawers.push(drawerHealth);
        } else if (usagePercent >= 80) {
          nearFullDrawers.push(drawerHealth);
        }
      }
    }

    for (const student of students) {
      const cabinetId = student.cabinet?.toString();
      const drawerId = student.drawer?.toString();
      let reason = '';

      // Archived students live in archive boxes — cabinet/drawer are intentionally cleared.
      if (isArchivedStudent(student) && hasValidArchiveLocation(student)) {
        continue;
      }

      if (isArchivedStudent(student)) {
        reason = 'Archived but missing archive box';
      } else if (!cabinetId) {
        reason = 'Missing cabinet';
      } else if (!drawerId) {
        reason = 'Missing drawer';
      } else if (!cabinetMap.has(cabinetId)) {
        reason = 'Cabinet does not exist or is outside this school';
      } else if (!drawerMap.has(`${cabinetId}:${drawerId}`)) {
        reason = 'Drawer does not exist in assigned cabinet';
      }

      if (reason) {
        badAssignments.push({
          studentId: student._id.toString(),
          studentNumber: student.studentId,
          studentName: formatFullName(student) || 'Unnamed Student',
          school: student.school,
          cabinet: cabinetId,
          drawer: drawerId,
          reason,
        });
      }
    }

    fullDrawers.sort((a, b) => b.usagePercent - a.usagePercent);
    nearFullDrawers.sort((a, b) => b.usagePercent - a.usagePercent);
    overCapacityCabinets.sort((a, b) => b.overBy - a.overBy);

    return NextResponse.json({
      summary: {
        cabinets: activeCabinets.length,
        archivedCabinets: archivedCabinetCount,
        drawers: activeCabinets.reduce((sum, cabinet) => sum + (cabinet.drawers?.length || 0), 0),
        fullDrawers: fullDrawers.length,
        nearFullDrawers: nearFullDrawers.length,
        emptyDrawers: emptyDrawers.length,
        overCapacityCabinets: overCapacityCabinets.length,
        badAssignments: badAssignments.length,
      },
      fullDrawers,
      nearFullDrawers,
      emptyDrawers,
      overCapacityCabinets,
      badAssignments,
    });
  } catch (error) {
    console.error('Error fetching cabinet health:', error);
    return NextResponse.json({ error: 'Failed to fetch cabinet health' }, { status: 500 });
  }
}
