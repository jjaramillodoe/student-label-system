import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import clientPromise from '@/lib/mongodb';
import { assignStudentsToNextSlot, moveStudentsToDrawer } from '@/lib/cabinetMoves';

/**
 * POST { studentIds, auto?: true, targetCabinetId?, targetDrawerId?, note?, source? }
 * Auto-assign to next open drawer, or move to an explicit target.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = session?.user?.role;
    const userSchool = session?.user?.school;

    if (!session || (userRole !== 'Admin' && userRole !== 'Data Lead')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const studentIds = Array.isArray(body.studentIds) ? body.studentIds : [];
    if (studentIds.length === 0) {
      return NextResponse.json({ error: 'Select at least one student' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('student-label');
    const schoolScope = userRole !== 'Admin' ? userSchool || null : null;
    const user = {
      name: session.user?.name,
      email: session.user?.email,
      role: userRole,
      school: userSchool,
    };

    const result =
      body.targetCabinetId && body.targetDrawerId
        ? await moveStudentsToDrawer(db, {
            studentIds,
            targetCabinetId: body.targetCabinetId,
            targetDrawerId: body.targetDrawerId,
            note: body.note,
            source: body.source || 'assign-fix',
            schoolScope,
            user,
          })
        : await assignStudentsToNextSlot(db, {
            studentIds,
            note: body.note,
            source: body.source || 'assign-next-slot',
            schoolScope,
            user,
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
    console.error('[assign-next-slot]', error);
    return NextResponse.json({ error: 'Failed to assign students' }, { status: 500 });
  }
}
