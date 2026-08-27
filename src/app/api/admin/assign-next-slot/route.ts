import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrDataLead } from '@/lib/requireSession';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { assignStudentsToNextSlot, moveStudentsToDrawer } from '@/lib/cabinetMoves';

/**
 * POST { studentIds, auto?: true, targetCabinetId?, targetDrawerId?, note?, source?, reactivateFromArchive? }
 * Auto-assign to next open drawer, or move to an explicit target.
 * When reactivateFromArchive is true, clears archive box fields and sets archived=false after a successful move.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdminOrDataLead();
    if (!auth.ok) return auth.response;
    const userRole = auth.user.role;
    const userSchool = auth.user.school;

    const body = await req.json();
    const studentIds = Array.isArray(body.studentIds) ? body.studentIds : [];
    if (studentIds.length === 0) {
      return NextResponse.json({ error: 'Select at least one student' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('student-label');
    const schoolScope = userRole !== 'Admin' ? userSchool || null : null;
    const user = {
      name: auth.user?.name,
      email: auth.user?.email,
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

    if (body.reactivateFromArchive === true && result.moved > 0) {
      const objectIds = studentIds
        .map((id: string) => {
          try {
            return new ObjectId(id);
          } catch {
            return null;
          }
        })
        .filter((id: ObjectId | null): id is ObjectId => Boolean(id));

      if (objectIds.length > 0) {
        await db.collection('students').updateMany(
          { _id: { $in: objectIds } },
          {
            $set: {
              archived: false,
              status: 'Active',
              updatedAt: new Date().toISOString(),
            },
            $unset: {
              archiveBoxId: '',
              archiveBoxLabel: '',
              archiveLocation: '',
              archiveId: '',
              archiveSchoolYear: '',
              archivedAt: '',
            },
          },
        );
      }
    }

    return NextResponse.json({
      success: true,
      moved: result.moved,
      errors: result.errors,
      message: body.reactivateFromArchive
        ? `${result.message || `Moved ${result.moved}`}. Cleared archive box fields and set Active.`
        : result.message,
      reactivatedFromArchive: body.reactivateFromArchive === true,
    });
  } catch (error) {
    console.error('[assign-next-slot]', error);
    return NextResponse.json({ error: 'Failed to assign students' }, { status: 500 });
  }
}
