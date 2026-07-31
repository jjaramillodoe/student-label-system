import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import clientPromise from '@/lib/mongodb';
import { reassignStudentsToSection } from '@/lib/cabinetMoves';

/**
 * POST — reassign students to a section within the same drawer.
 * Body: { studentIds, drawerId, drawerSection, note? }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !['Admin', 'Data Lead'].includes(session.user?.role || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: cabinetId } = await params;
    const body = await request.json();
    const { studentIds, drawerId, drawerSection, note } = body;

    const client = await clientPromise;
    const db = client.db('student-label');
    const schoolScope =
      session.user.role === 'Admin' ? null : session.user.school || null;

    const result = await reassignStudentsToSection(db, {
      studentIds: Array.isArray(studentIds) ? studentIds : [],
      cabinetId,
      drawerId,
      drawerSection,
      note,
      source: 'cabinets-section-drag',
      user: {
        name: session.user.name,
        email: session.user.email,
        role: session.user.role,
        school: session.user.school,
      },
      schoolScope,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || 'Reassign failed' },
        { status: result.status || 400 },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[reassign-section]', error);
    return NextResponse.json({ error: 'Failed to reassign section' }, { status: 500 });
  }
}
