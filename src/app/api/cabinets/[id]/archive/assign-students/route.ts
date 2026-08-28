import { NextResponse } from 'next/server';
import { requireSession, requireAdminOrDataLead } from '@/lib/requireSession';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import {
  buildPhysicalBoxes,
  countPendingArchiveAssignments,
  relabelPhysicalBoxes,
  syncArchiveStudentsToBoxes,
  totalBoxCapacity,
} from '@/lib/archiveBoxes';
import { isCabinetArchived } from '@/lib/cabinets';

/**
 * GET /api/cabinets/[id]/archive/assign-students
 * Returns how many student files still need box assignment.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSession();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const client = await clientPromise;
    const db = client.db('student-label');

    const cabinet = await db.collection('cabinets').findOne({ _id: new ObjectId(id) });
    if (!cabinet || !isCabinetArchived(cabinet)) {
      return NextResponse.json({ pending: 0, inCabinet: 0 });
    }

    const archiveRecord = await db.collection('cabinet_archives')
      .findOne({ cabinetId: id }, { sort: { createdAt: -1 } });

    if (!archiveRecord) {
      return NextResponse.json({ pending: cabinet.currentCount || 0, inCabinet: cabinet.currentCount || 0 });
    }

    const archiveRecordId = archiveRecord._id.toString();
    const physicalBoxes = archiveRecord.physicalBoxes || [];
    const inCabinet = await db.collection('students').countDocuments({ cabinet: id });
    const pending = await countPendingArchiveAssignments(db, id, archiveRecordId, physicalBoxes);

    return NextResponse.json({ pending, inCabinet, archiveRecordId });
  } catch (error) {
    console.error('Error checking archive assignment status:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/cabinets/[id]/archive/assign-students
 *
 * Assigns or re-syncs student files into archive boxes for an archived cabinet.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminOrDataLead();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const client = await clientPromise;
    const db = client.db('student-label');

    const cabinet = await db.collection('cabinets').findOne({ _id: new ObjectId(id) });
    if (!cabinet) {
      return NextResponse.json({ error: 'Cabinet not found' }, { status: 404 });
    }

    if (!isCabinetArchived(cabinet)) {
      return NextResponse.json({ error: 'Cabinet must be archived first' }, { status: 400 });
    }

    if (auth.user.role !== 'Admin' && auth.user.school && cabinet.school !== auth.user.school) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const archiveRecord = await db.collection('cabinet_archives')
      .findOne({ cabinetId: id }, { sort: { createdAt: -1 } });

    if (!archiveRecord) {
      return NextResponse.json({ error: 'No archive record found for this cabinet' }, { status: 404 });
    }

    let physicalBoxes = archiveRecord.physicalBoxes;
    if (!physicalBoxes || physicalBoxes.length === 0) {
      physicalBoxes = buildPhysicalBoxes(archiveRecord.boxes, {
        cabinetName: archiveRecord.cabinetName || cabinet.name,
        cabinetIdentifier: archiveRecord.cabinetIdentifier ?? cabinet.identifier,
        schoolYear: archiveRecord.schoolYear,
        drawerNames: (cabinet.drawers || []).map((d: { name: string }) => d.name),
      });
    } else {
      physicalBoxes = relabelPhysicalBoxes(physicalBoxes, {
        cabinetName: archiveRecord.cabinetName || cabinet.name,
        cabinetIdentifier: archiveRecord.cabinetIdentifier ?? cabinet.identifier,
        schoolYear: archiveRecord.schoolYear,
        drawerNames: (cabinet.drawers || []).map((d: { name: string }) => d.name),
      });
    }

    const pending = await countPendingArchiveAssignments(
      db,
      id,
      archiveRecord._id.toString(),
      physicalBoxes,
    );

    const totalArchiveStudents = await db.collection('students').countDocuments({
      $or: [
        { cabinet: id },
        { archiveId: archiveRecord._id.toString() },
        { archiveBoxId: { $in: physicalBoxes.map((b: { _id: string }) => b._id) } },
      ],
    });

    if (pending === 0 && totalArchiveStudents === 0) {
      return NextResponse.json({
        success: true,
        assigned: 0,
        message: 'No student files found for this archived cabinet.',
      });
    }

    const studentCount = Math.max(pending, totalArchiveStudents);
    if (studentCount > totalBoxCapacity(physicalBoxes)) {
      return NextResponse.json({
        error: `Not enough box capacity. ${studentCount} student files need boxes but capacity is ${totalBoxCapacity(physicalBoxes)}. Add more boxes to the archive record.`,
      }, { status: 400 });
    }

    const archiveRecordId = archiveRecord._id.toString();
    const { assigned } = await syncArchiveStudentsToBoxes(
      db,
      id,
      archiveRecordId,
      physicalBoxes,
      {
        location: archiveRecord.location,
        schoolYear: archiveRecord.schoolYear,
        archivedAt: archiveRecord.createdAt || new Date().toISOString(),
      },
    );

    return NextResponse.json({ success: true, assigned, boxCount: physicalBoxes.length });
  } catch (error) {
    console.error('Error assigning students to archive boxes:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
