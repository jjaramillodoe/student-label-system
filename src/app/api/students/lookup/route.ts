import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';

/**
 * GET /api/students/lookup?studentId=1979-EC-0000048
 *
 * Public endpoint — no authentication required.
 * The student ID embedded in the QR URL is the access key.
 * Returns the fields needed for the student details page.
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
    const student = await db.collection('students').findOne({
      $or: [{ labelId: studentId }, { studentId }],
    });
    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Resolve cabinet and drawer names (active filing)
    let cabinetName = student.cabinet || null;
    let drawerName = student.drawer || null;

    if (student.cabinet) {
      try {
        const isId = /^[a-f\d]{24}$/i.test(student.cabinet);
        const cabinetDoc = isId
          ? await db.collection('cabinets').findOne({ _id: new ObjectId(student.cabinet) })
          : await db.collection('cabinets').findOne({ name: student.cabinet });
        if (cabinetDoc) {
          cabinetName = cabinetDoc.name || cabinetDoc.label || student.cabinet;
          if (student.drawer) {
            const drawerObj = (cabinetDoc.drawers || []).find(
              (d: any) => d._id?.toString() === student.drawer || d.name === student.drawer
            );
            if (drawerObj) drawerName = drawerObj.name || student.drawer;
          }
        }
      } catch {
        // Cabinet/drawer lookup failed — fall back to raw values
      }
    }

    // Resolve sibling records if confirmed
    let siblings: Array<{ _id: string; firstName: string; lastName: string; labelId?: string; studentId?: string }> = [];
    if (Array.isArray(student.siblingWith) && student.siblingWith.length > 0) {
      try {
        const siblingIds = student.siblingWith.map((id: string) => new ObjectId(id));
        const siblingDocs = await db.collection('students')
          .find({ _id: { $in: siblingIds } })
          .project({ firstName: 1, lastName: 1, labelId: 1, studentId: 1 })
          .toArray();
        siblings = siblingDocs.map((s: any) => ({
          _id: s._id.toString(),
          firstName: s.firstName,
          lastName: s.lastName,
          labelId: s.labelId,
          studentId: s.studentId,
        }));
      } catch { /* ignore sibling resolution errors */ }
    }

    return NextResponse.json({
      ...student,
      _id: student._id.toString(),
      cabinetName,
      drawerName,
      // Archive box fields (when student was moved to end-of-year boxes)
      archiveBoxLabel: student.archiveBoxLabel || null,
      archiveLocation: student.archiveLocation || null,
      archiveSchoolYear: student.archiveSchoolYear || null,
      archiveBoxId: student.archiveBoxId || null,
      siblings,
    });
  } catch (error) {
    console.error('Error looking up student:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
