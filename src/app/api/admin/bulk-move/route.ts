import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import clientPromise from '@/lib/mongodb';
import { moveStudentsToDrawer } from '@/lib/cabinetMoves';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = session?.user?.role;
    const userSchool = session?.user?.school;

    if (!session || (userRole !== 'Admin' && userRole !== 'Data Lead')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { studentIds, targetCabinetId, targetDrawerId, note, source } = body;

    const client = await clientPromise;
    const db = client.db('student-label');

    const result = await moveStudentsToDrawer(db, {
      studentIds,
      targetCabinetId,
      targetDrawerId,
      note,
      source: source || 'bulk-move',
      schoolScope: userRole !== 'Admin' ? userSchool || null : null,
      user: {
        name: session.user?.name,
        email: session.user?.email,
        role: userRole,
        school: userSchool,
      },
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status || 400 });
    }

    return NextResponse.json({
      success: true,
      moved: result.moved,
      errors: result.errors,
      message: result.message,
    });
  } catch (error) {
    console.error('Error bulk moving students:', error);
    return NextResponse.json({ error: 'Failed to move students' }, { status: 500 });
  }
}
