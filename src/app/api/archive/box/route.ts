import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { findArchiveBoxByPublicId } from '@/lib/archiveBoxes';

/**
 * GET /api/archive/box?boxId=...
 *
 * Public endpoint — no authentication required.
 * Returns archive box metadata and the student files stored in it.
 */
export async function GET(req: NextRequest) {
  try {
    const boxId = req.nextUrl.searchParams.get('boxId')?.trim();
    if (!boxId) {
      return NextResponse.json({ error: 'boxId query param required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('student-label');

    const match = await findArchiveBoxByPublicId(db, boxId);
    if (!match) {
      return NextResponse.json({ error: 'Archive box not found' }, { status: 404 });
    }

    const { archiveRecord, box } = match;

    const students = await db.collection('students')
      .find({ archiveBoxId: boxId })
      .project({
        firstName: 1,
        lastName: 1,
        labelId: 1,
        studentId: 1,
        dob: 1,
        status: 1,
      })
      .sort({ lastName: 1, firstName: 1 })
      .toArray();

    return NextResponse.json({
      box: {
        _id: String(box._id),
        label: box.label,
        boxNumber: box.boxNumber,
        filesPerBox: box.filesPerBox,
        maxCapacity: box.maxCapacity,
        currentCount: box.currentCount,
      },
      archive: {
        cabinetName: archiveRecord.cabinetName,
        cabinetIdentifier: archiveRecord.cabinetIdentifier,
        school: archiveRecord.school,
        schoolYear: archiveRecord.schoolYear,
        location: archiveRecord.location,
        archiveDate: archiveRecord.archiveDate,
      },
      students: students.map((s) => ({
        _id: String(s._id),
        firstName: s.firstName as string | undefined,
        lastName: s.lastName as string | undefined,
        labelId: s.labelId as string | undefined,
        studentId: s.studentId as string | undefined,
        dob: s.dob as string | undefined,
        status: s.status as string | undefined,
      })),
    });
  } catch (error) {
    console.error('Error looking up archive box:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
