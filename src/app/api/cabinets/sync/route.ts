import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import clientPromise from '@/lib/mongodb';

/**
 * POST /api/cabinets/sync
 *
 * Recalculates every cabinet's currentCount and every drawer's currentCount
 * by counting actual students from the students collection.
 * This is the source of truth — it fixes any drift caused by bulk imports,
 * moves, deletes, or other operations that didn't maintain the counters.
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
    const skipped: string[] = [];

    for (const cabinet of cabinets) {
      try {
        const cabinetId = cabinet._id.toString();

        // Count total students in this cabinet
        const cabinetTotal = await db
          .collection('students')
          .countDocuments({ cabinet: cabinetId });

        // Build $set payload: cabinet total + every drawer's individual count
        const setPayload: Record<string, any> = {
          currentCount: cabinetTotal,
          updatedAt: new Date().toISOString(),
        };

        for (let idx = 0; idx < (cabinet.drawers || []).length; idx++) {
          const drawer = cabinet.drawers[idx];
          const drawerCount = await db
            .collection('students')
            .countDocuments({ drawer: drawer._id });
          setPayload[`drawers.${idx}.currentCount`] = drawerCount;
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
      skipped,
      warning: skipped.length > 0,
      message: `Cabinet counts recalculated from student data. ${updated} cabinet${updated !== 1 ? 's' : ''} updated.${skipped.length > 0 ? ` ${skipped.length} skipped.` : ''}`,
    });
  } catch (error) {
    console.error('Cabinet sync error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
