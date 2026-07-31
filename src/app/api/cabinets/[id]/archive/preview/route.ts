import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import {
  ARCHIVE_ELIGIBLE_STATUSES,
  buildPhysicalBoxes,
  cabinetStudentsQuery,
  previewArchivePacking,
  totalBoxCapacity,
} from '@/lib/archiveBoxes';
import { formatFullName } from '@/lib/personName';

/**
 * POST — preview who goes in which archive box (no writes).
 * Body: { schoolYear, boxes, statuses?, drawerIds?, manualAssignments? }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !['Admin', 'Data Lead'].includes(session.user?.role || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { schoolYear, boxes, statuses, drawerIds, manualAssignments } = body;

    if (!schoolYear || !boxes || !Array.isArray(boxes) || boxes.length === 0) {
      return NextResponse.json({ error: 'schoolYear and boxes are required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('student-label');
    const cabinet = await db.collection('cabinets').findOne({ _id: new ObjectId(id) });
    if (!cabinet) {
      return NextResponse.json({ error: 'Cabinet not found' }, { status: 404 });
    }

    if (session.user.role !== 'Admin' && session.user.school && cabinet.school !== session.user.school) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const filter = {
      statuses: Array.isArray(statuses) && statuses.length ? statuses : undefined,
      drawerIds: Array.isArray(drawerIds) && drawerIds.length ? drawerIds : undefined,
    };

    const students = await db
      .collection('students')
      .find(cabinetStudentsQuery(id, filter))
      .sort({ lastName: 1, firstName: 1 })
      .toArray();

    const physicalBoxes = buildPhysicalBoxes(boxes, {
      cabinetName: cabinet.name,
      cabinetIdentifier: cabinet.identifier,
      schoolYear,
      drawerNames: (cabinet.drawers || []).map((d: { name: string }) => d.name),
    });

    const drawerIdToName = new Map<string, string>();
    for (const d of cabinet.drawers || []) {
      if (d._id && d.name) drawerIdToName.set(String(d._id), d.name);
    }

    const preview = previewArchivePacking(
      students,
      physicalBoxes,
      drawerIdToName,
      manualAssignments,
    );

    return NextResponse.json({
      studentCount: students.length,
      boxCapacity: totalBoxCapacity(physicalBoxes),
      enoughCapacity: students.length <= totalBoxCapacity(physicalBoxes),
      eligibleStatuses: ARCHIVE_ELIGIBLE_STATUSES,
      drawers: (cabinet.drawers || []).map((d: { _id: string; name: string; currentCount: number }) => ({
        _id: d._id,
        name: d.name,
        currentCount: d.currentCount,
      })),
      boxes: preview.boxes.map((b) => ({
        _id: b._id,
        label: b.label,
        boxNumber: b.boxNumber,
        drawerName: b.drawerName,
        maxCapacity: b.maxCapacity,
        currentCount: b.currentCount,
      })),
      rows: preview.rows.map((r) => {
        const s = students.find((stu) => String(stu._id) === r.studentId);
        const formatted = s
          ? formatFullName({
              firstName: typeof s.firstName === 'string' ? s.firstName : undefined,
              lastName: typeof s.lastName === 'string' ? s.lastName : undefined,
            })
          : '';
        return { ...r, name: formatted || r.name };
      }),
    });
  } catch (error) {
    console.error('[archive/preview]', error);
    const message = error instanceof Error ? error.message : 'Preview failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
