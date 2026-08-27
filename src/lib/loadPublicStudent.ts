import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import {
  PUBLIC_STUDENT_LOOKUP_PROJECTION,
  toPublicStudentLookup,
  type PublicSiblingLookup,
  type PublicStudentLookup,
} from '@/lib/publicStudentLookup';

export async function loadPublicStudentLookup(
  studentId: string,
): Promise<PublicStudentLookup | null> {
  const id = studentId.trim();
  if (!id) return null;

  const client = await clientPromise;
  const db = client.db('student-label');

  const student = await db.collection('students').findOne(
    { $or: [{ labelId: id }, { studentId: id }] },
    { projection: PUBLIC_STUDENT_LOOKUP_PROJECTION },
  );
  if (!student) return null;

  let cabinetName: string | null = typeof student.cabinet === 'string' ? student.cabinet : null;
  let drawerName: string | null = typeof student.drawer === 'string' ? student.drawer : null;

  if (student.cabinet) {
    try {
      const cabinetKey = student.cabinet.toString();
      const isId = /^[a-f\d]{24}$/i.test(cabinetKey);
      const cabinetDoc = isId
        ? await db.collection('cabinets').findOne({ _id: new ObjectId(cabinetKey) })
        : await db.collection('cabinets').findOne({ name: cabinetKey });
      if (cabinetDoc) {
        cabinetName = cabinetDoc.name || cabinetDoc.label || cabinetKey;
        if (student.drawer) {
          const drawerKey = String(student.drawer);
          const drawers = Array.isArray(cabinetDoc.drawers) ? cabinetDoc.drawers : [];
          const drawerObj = drawers.find((d: { _id?: unknown; name?: string }) =>
            d._id?.toString() === drawerKey || d.name === drawerKey,
          );
          if (drawerObj) drawerName = drawerObj.name || drawerKey;
        }
      }
    } catch {
      // Cabinet/drawer lookup failed — fall back to raw values
    }
  }

  let siblings: PublicSiblingLookup[] = [];
  if (Array.isArray(student.siblingWith) && student.siblingWith.length > 0) {
    try {
      const siblingIds = student.siblingWith
        .map((raw: unknown) => {
          try {
            return new ObjectId(String(raw));
          } catch {
            return null;
          }
        })
        .filter((oid): oid is ObjectId => oid !== null);
      const siblingDocs = await db.collection('students')
        .find({ _id: { $in: siblingIds } })
        .project({ firstName: 1, lastName: 1, labelId: 1, studentId: 1 })
        .toArray();
      siblings = siblingDocs.map((s) => ({
        _id: s._id.toString(),
        firstName: typeof s.firstName === 'string' ? s.firstName : undefined,
        lastName: typeof s.lastName === 'string' ? s.lastName : undefined,
        labelId: typeof s.labelId === 'string' ? s.labelId : undefined,
        studentId: typeof s.studentId === 'string' ? s.studentId : undefined,
      }));
    } catch {
      /* ignore sibling resolution errors */
    }
  }

  return toPublicStudentLookup(student as Record<string, unknown>, {
    cabinetName,
    drawerName,
    siblings,
  });
}
