import clientPromise from '@/lib/mongodb';
import { findArchiveBoxByPublicId } from '@/lib/archiveBoxes';
import {
  PUBLIC_ARCHIVE_BOX_STUDENT_PROJECTION,
  toPublicArchiveBoxStudent,
  type PublicArchiveBoxStudent,
} from '@/lib/publicArchiveBox';

export type PublicArchiveBoxPayload = {
  box: {
    _id: string;
    label: string;
    boxNumber: number;
    filesPerBox: number;
    maxCapacity: number;
    currentCount: number;
  };
  archive: {
    cabinetName: string;
    cabinetIdentifier?: string | null;
    school?: string | null;
    schoolYear: string;
    location: string;
    archiveDate: string;
  };
  students: PublicArchiveBoxStudent[];
};

export async function loadPublicArchiveBox(
  boxId: string,
): Promise<PublicArchiveBoxPayload | null> {
  const id = boxId.trim();
  if (!id) return null;

  const client = await clientPromise;
  const db = client.db('student-label');

  const match = await findArchiveBoxByPublicId(db, id);
  if (!match) return null;

  const { archiveRecord, box } = match;
  const students = await db.collection('students')
    .find({ archiveBoxId: id })
    .project(PUBLIC_ARCHIVE_BOX_STUDENT_PROJECTION)
    .sort({ lastName: 1, firstName: 1 })
    .toArray();

  return {
    box: {
      _id: String(box._id),
      label: box.label,
      boxNumber: box.boxNumber,
      filesPerBox: box.filesPerBox,
      maxCapacity: box.maxCapacity,
      currentCount: box.currentCount,
    },
    archive: {
      cabinetName: archiveRecord.cabinetName || '',
      cabinetIdentifier: archiveRecord.cabinetIdentifier,
      school: archiveRecord.school,
      schoolYear: archiveRecord.schoolYear || '',
      location: archiveRecord.location || '',
      archiveDate: archiveRecord.archiveDate || '',
    },
    students: students.map((s) => toPublicArchiveBoxStudent(s as Record<string, unknown>)),
  };
}
