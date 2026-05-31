import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { ObjectId } from 'mongodb';
import { authOptions } from '@/lib/authOptions';
import clientPromise from '@/lib/mongodb';

function isValidObjectId(id: string) {
  try {
    new ObjectId(id);
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = session?.user?.role;
    const userSchool = session?.user?.school;

    if (!session || (userRole !== 'Admin' && userRole !== 'Data Lead')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { studentIds, targetCabinetId, targetDrawerId } = await req.json();

    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return NextResponse.json({ error: 'Select at least one student to move' }, { status: 400 });
    }

    if (!targetCabinetId || !targetDrawerId || !isValidObjectId(targetCabinetId)) {
      return NextResponse.json({ error: 'Target cabinet and drawer are required' }, { status: 400 });
    }

    const invalidStudentId = studentIds.find((id: string) => !isValidObjectId(id));
    if (invalidStudentId) {
      return NextResponse.json({ error: `Invalid student id: ${invalidStudentId}` }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('student-label');
    const targetCabinet = await db.collection('cabinets').findOne({ _id: new ObjectId(targetCabinetId) });

    if (!targetCabinet) {
      return NextResponse.json({ error: 'Target cabinet not found' }, { status: 404 });
    }

    if (userRole !== 'Admin' && userSchool && targetCabinet.school !== userSchool) {
      return NextResponse.json({ error: 'Target cabinet is outside your school' }, { status: 403 });
    }

    const targetDrawer = (targetCabinet.drawers || []).find((drawer: any) => drawer._id === targetDrawerId);
    if (!targetDrawer) {
      return NextResponse.json({ error: 'Target drawer not found in cabinet' }, { status: 404 });
    }

    const available = (targetDrawer.capacity || 0) - (targetDrawer.currentCount || 0);
    if (available < studentIds.length) {
      return NextResponse.json({
        error: `Target drawer only has ${available} available space(s) for ${studentIds.length} selected student(s)`,
      }, { status: 400 });
    }

    const studentObjectIds = studentIds.map((id: string) => new ObjectId(id));
    const studentQuery: any = { _id: { $in: studentObjectIds } };
    if (userRole !== 'Admin' && userSchool) {
      studentQuery.school = userSchool;
    }

    const students = await db.collection('students').find(studentQuery).toArray();
    if (students.length !== studentIds.length) {
      return NextResponse.json({ error: 'Some students were not found or are outside your school' }, { status: 400 });
    }

    let moved = 0;
    const errors: string[] = [];

    for (const student of students) {
      try {
        if (student.cabinet && student.drawer && isValidObjectId(student.cabinet)) {
          await db.collection('cabinets').updateOne(
            { _id: new ObjectId(student.cabinet), 'drawers._id': student.drawer },
            { $inc: { 'drawers.$.currentCount': -1, currentCount: -1 } }
          );
        }

        await db.collection('students').updateOne(
          { _id: student._id },
          {
            $set: {
              cabinet: targetCabinetId,
              drawer: targetDrawerId,
              updatedAt: new Date().toISOString(),
            },
          }
        );

        await db.collection('cabinets').updateOne(
          { _id: new ObjectId(targetCabinetId), 'drawers._id': targetDrawerId },
          { $inc: { 'drawers.$.currentCount': 1, currentCount: 1 } }
        );

        moved++;
      } catch (error) {
        errors.push(`Failed to move ${student.studentId || student._id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      success: true,
      moved,
      errors,
      message: `Moved ${moved} student${moved === 1 ? '' : 's'} to ${targetCabinet.name} / ${targetDrawer.name}`,
    });
  } catch (error) {
    console.error('Error bulk moving students:', error);
    return NextResponse.json({ error: 'Failed to move students' }, { status: 500 });
  }
}
