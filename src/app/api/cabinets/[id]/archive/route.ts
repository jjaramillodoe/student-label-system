import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import {
  buildPhysicalBoxes,
  moveCabinetStudentsToArchiveBoxes,
  totalBoxCapacity,
} from '@/lib/archiveBoxes';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== 'Admin' && session.user.role !== 'Data Lead')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { schoolYear, boxes, location, archiveDate, notes } = body;

    if (!schoolYear || !boxes || !Array.isArray(boxes) || boxes.length === 0 || !location) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('student-label');

    const cabinet = await db.collection('cabinets').findOne({ _id: new ObjectId(id) });
    if (!cabinet) {
      return NextResponse.json({ error: 'Cabinet not found' }, { status: 404 });
    }

    if (cabinet.status === 'Archived') {
      return NextResponse.json({ error: 'Cabinet is already archived' }, { status: 400 });
    }

    if (session.user.role !== 'Admin' && session.user.school && cabinet.school !== session.user.school) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const studentsInCabinet = await db.collection('students').countDocuments({ cabinet: id });
    const physicalBoxes = buildPhysicalBoxes(boxes, {
      cabinetName: cabinet.name,
      cabinetIdentifier: cabinet.identifier,
      schoolYear,
      drawerNames: (cabinet.drawers || []).map((d: { name: string }) => d.name),
    });

    if (studentsInCabinet > totalBoxCapacity(physicalBoxes)) {
      return NextResponse.json({
        error: `Not enough box capacity. Cabinet has ${studentsInCabinet} student files but boxes only hold ${totalBoxCapacity(physicalBoxes)}. Add more boxes.`,
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
      studentCountAtArchive: studentsInCabinet,
      location,
      archiveDate: archiveDate || archivedAt.split('T')[0],
      archivedBy: session.user.name || session.user.email || 'Unknown',
      notes: notes || '',
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
    );

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

    return NextResponse.json({
      success: true,
      archiveId: result.insertedId,
      studentsAssigned: assigned,
      boxCount: physicalBoxes.length,
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
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const client = await clientPromise;
    const db = client.db('student-label');

    const records = await db
      .collection('cabinet_archives')
      .find({ cabinetId: id })
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json(records);
  } catch (error) {
    console.error('Error fetching archive records:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
