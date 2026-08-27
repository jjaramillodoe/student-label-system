import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrDataLead } from '@/lib/requireSession';
import clientPromise from '@/lib/mongodb';
import { moveStudentsToDrawer } from '@/lib/cabinetMoves';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdminOrDataLead();
    if (!auth.ok) return auth.response;
    const userRole = auth.user.role;
    const userSchool = auth.user.school;

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
        name: auth.user?.name,
        email: auth.user?.email,
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
