import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import {
  PUBLIC_STUDENT_LOOKUP_PROJECTION,
  toPublicStudentLookup,
  type PublicSiblingLookup,
} from '@/lib/publicStudentLookup';

/**
 * GET /api/students/lookup?studentId=1979-EC-0000048
 *
 * Public endpoint — no authentication required.
 * The student ID embedded in the QR URL is the access key.
 * Returns a field-whitelisted payload for the public student page and cabinet locate scan.
 */
export async function GET(req: NextRequest) {
  try {
    const studentId = req.nextUrl.searchParams.get('studentId');
    if (!studentId) {
      return NextResponse.json({ error: 'studentId query param required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('student-label');

    // Search by labelId first (new field), then fall back to legacy studentId field
    const student = await db.collection('students').findOne(
      { $or: [{ labelId: studentId }, { studentId }] },
      { projection: PUBLIC_STUDENT_LOOKUP_PROJECTION },
    );
    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Resolve cabinet and drawer names (active filing)
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
          .map((id: unknown) => {
            try {
              return new ObjectId(String(id));
            } catch {
              return null;
            }
          })
          .filter((id): id is ObjectId => id !== null);
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

    return NextResponse.json(
      toPublicStudentLookup(student as Record<string, unknown>, {
        cabinetName,
        drawerName,
        siblings,
      }),
    );
  } catch (error) {
    console.error('Error looking up student:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
