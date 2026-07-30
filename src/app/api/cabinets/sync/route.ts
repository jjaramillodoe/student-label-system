import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import clientPromise from '@/lib/mongodb';
import { assignDrawerSection } from '@/lib/drawerSections';

/**
 * POST /api/cabinets/sync
 *
 * Recalculates every cabinet's currentCount and every drawer's currentCount
 * by counting actual students from the students collection.
 * Also backfills automatic drawerSection (Section 01–08) by createdAt order.
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !['Admin', 'Data Lead'].includes(session.user.role || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db('student-label');

    const cabinetQuery =
      session.user.role === 'Admin' ? {} : { school: session.user.school };

    const cabinets = await db.collection('cabinets').find(cabinetQuery).toArray();
    let updated = 0;
    let sectionsAssigned = 0;
    const skipped: string[] = [];

    for (const cabinet of cabinets) {
      try {
        const cabinetId = cabinet._id.toString();

        const cabinetTotal = await db
          .collection('students')
          .countDocuments({ cabinet: cabinetId });

        const setPayload: Record<string, any> = {
          currentCount: cabinetTotal,
          updatedAt: new Date().toISOString(),
        };

        for (let idx = 0; idx < (cabinet.drawers || []).length; idx++) {
          const drawer = cabinet.drawers[idx];
          const drawerId = String(drawer._id);
          const studentsInDrawer = await db
            .collection('students')
            .find({
              cabinet: cabinetId,
              drawer: drawerId,
              archived: { $ne: true },
              status: { $ne: 'Archived' },
            })
            .sort({ createdAt: 1, _id: 1 })
            .project({ _id: 1 })
            .toArray();

          setPayload[`drawers.${idx}.currentCount`] = studentsInDrawer.length;

          const capacity = drawer.capacity || 400;
          for (let i = 0; i < studentsInDrawer.length; i++) {
            const section = assignDrawerSection(i, capacity);
            const result = await db.collection('students').updateOne(
              { _id: studentsInDrawer[i]._id },
              { $set: { drawerSection: section } },
            );
            if (result.modifiedCount > 0) sectionsAssigned += 1;
          }
        }

        await db
          .collection('cabinets')
          .updateOne({ _id: cabinet._id }, { $set: setPayload });

        updated++;
      } catch {
        skipped.push(cabinet.name);
      }
    }

    return NextResponse.json({
      success: true,
      updated,
      sectionsAssigned,
      skipped,
      warning: skipped.length > 0,
      message: `Cabinet counts recalculated. ${updated} cabinet${updated !== 1 ? 's' : ''} updated.${sectionsAssigned ? ` ${sectionsAssigned} section assignment${sectionsAssigned !== 1 ? 's' : ''} refreshed.` : ''}${skipped.length > 0 ? ` ${skipped.length} skipped.` : ''}`,
    });
  } catch (error) {
    console.error('Cabinet sync error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
