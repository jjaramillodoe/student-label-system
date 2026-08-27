import { NextResponse } from 'next/server';
import { requireAdminOrDataLead } from '@/lib/requireSession';
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
    const auth = await requireAdminOrDataLead();
    if (!auth.ok) return auth.response;

    const { id: cabinetId } = await params;
    const body = await request.json();
    const { studentIds, drawerId, drawerSection, note } = body;

    const client = await clientPromise;
    const db = client.db('student-label');
    const schoolScope =
      auth.user.role === 'Admin' ? null : auth.user.school || null;

    const result = await reassignStudentsToSection(db, {
      studentIds: Array.isArray(studentIds) ? studentIds : [],
      cabinetId,
      drawerId,
      drawerSection,
      note,
      source: 'cabinets-section-drag',
      user: {
        name: auth.user.name,
        email: auth.user.email,
        role: auth.user.role,
        school: auth.user.school,
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
