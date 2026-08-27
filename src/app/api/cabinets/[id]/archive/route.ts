import { NextResponse } from 'next/server';
import { requireSession, requireAdminOrDataLead } from '@/lib/requireSession';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import {
  buildPhysicalBoxes,
  cabinetStudentsQuery,
  moveCabinetStudentsToArchiveBoxes,
  totalBoxCapacity,
} from '@/lib/archiveBoxes';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminOrDataLead();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const body = await request.json();
    const {
      schoolYear,
      boxes,
      location,
      archiveDate,
      notes,
      statuses,
      drawerIds,
      manualAssignments,
      archiveCabinet = true,
    } = body;

    if (!schoolYear || !boxes || !Array.isArray(boxes) || boxes.length === 0 || !location) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('student-label');

    const cabinet = await db.collection('cabinets').findOne({ _id: new ObjectId(id) });
    if (!cabinet) {
      return NextResponse.json({ error: 'Cabinet not found' }, { status: 404 });
    }

    if (archiveCabinet && cabinet.status === 'Archived') {
      return NextResponse.json({ error: 'Cabinet is already archived' }, { status: 400 });
    }

    if (auth.user.role !== 'Admin' && auth.user.school && cabinet.school !== auth.user.school) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const filter = {
      statuses: Array.isArray(statuses) && statuses.length ? statuses as string[] : undefined,
      drawerIds: Array.isArray(drawerIds) && drawerIds.length ? drawerIds as string[] : undefined,
    };
    const isPartial = Boolean(filter.statuses || filter.drawerIds) || archiveCabinet === false;

    const studentsInScope = await db.collection('students').countDocuments(
      cabinetStudentsQuery(id, filter),
    );

    const physicalBoxes = buildPhysicalBoxes(boxes, {
      cabinetName: cabinet.name,
      cabinetIdentifier: cabinet.identifier,
      schoolYear,
      drawerNames: (cabinet.drawers || []).map((d: { name: string }) => d.name),
    });

    if (studentsInScope > totalBoxCapacity(physicalBoxes)) {
      return NextResponse.json({
        error: `Not enough box capacity. ${studentsInScope} student file(s) selected but boxes only hold ${totalBoxCapacity(physicalBoxes)}. Add more boxes.`,
      }, { status: 400 });
    }

    if (studentsInScope === 0) {
      return NextResponse.json({
        error: 'No students match the archive filter. Adjust status/drawer filters or use full archive.',
      }, { status: 400 });
    }

    const totalBoxFiles = boxes.reduce(
      (sum: number, b: { quantity: number; filesPerBox: number }) => sum + b.quantity * b.filesPerBox,
      0
    );

    const archivedAt = new Date().toISOString();
    const archiveRecord = {
      cabinetId: id,
      cabinetName: cabinet.name,
      cabinetIdentifier: cabinet.identifier || null,
      school: cabinet.school || null,
      schoolYear,
      boxes,
      physicalBoxes,
      totalBoxFiles,
      studentCountAtArchive: studentsInScope,
      location,
      archiveDate: archiveDate || archivedAt.split('T')[0],
      archivedBy: auth.user.name || auth.user.email || 'Unknown',
      notes: notes || '',
      partial: isPartial,
      filterStatuses: filter.statuses || null,
      filterDrawerIds: filter.drawerIds || null,
      manualAssignments: manualAssignments || null,
      createdAt: archivedAt,
    };

    const result = await db.collection('cabinet_archives').insertOne(archiveRecord);
    const archiveRecordId = result.insertedId.toString();

    const { assigned } = await moveCabinetStudentsToArchiveBoxes(
      db,
      id,
      archiveRecordId,
      physicalBoxes,
      { location, schoolYear, archivedAt },
      {
        filter,
        manualAssignments,
        zeroCabinetCounts: !isPartial,
      },
    );

    if (!isPartial && archiveCabinet !== false) {
      await db.collection('cabinets').updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            status: 'Archived',
            archivedAt,
            archiveRecordId,
            updatedAt: archivedAt,
          },
        }
      );
    } else {
      await db.collection('cabinets').updateOne(
        { _id: new ObjectId(id) },
        { $set: { updatedAt: archivedAt } },
      );
    }

    return NextResponse.json({
      success: true,
      archiveId: result.insertedId,
      studentsAssigned: assigned,
      boxCount: physicalBoxes.length,
      partial: isPartial,
    });
  } catch (error) {
    console.error('Error archiving cabinet:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSession();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const client = await clientPromise;
    const db = client.db('student-label');

    const archive = await db.collection('cabinet_archives').findOne({ cabinetId: id });
    if (!archive) {
      return NextResponse.json({ error: 'Archive record not found' }, { status: 404 });
    }

    return NextResponse.json(archive);
  } catch (error) {
    console.error('Error fetching archive:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
