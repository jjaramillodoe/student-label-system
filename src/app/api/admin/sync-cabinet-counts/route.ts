import { NextResponse } from 'next/server';
import { requireAdminOrDataLead } from '@/lib/requireSession';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST() {
  try {
    const auth = await requireAdminOrDataLead();
    if (!auth.ok) return auth.response;

    const client = await clientPromise;
    const db = client.db('student-label');

    // Scope: Admins see all, Data Leads see their school only
    const cabinetQuery = auth.user.role === 'Admin' ? {} : { school: auth.user.school };
    const cabinets = await db.collection('cabinets').find(cabinetQuery).toArray();

    let totalCabinets = 0;
    let totalDrawers = 0;
    const results: { cabinet: string; before: number; after: number }[] = [];

    for (const cabinet of cabinets) {
      const cabinetId = cabinet._id.toString();

      // Count actual students per drawer
      const drawerUpdates: Record<string, number> = {};
      for (const drawer of cabinet.drawers || []) {
        const count = await db.collection('students').countDocuments({ drawer: drawer._id });
        drawerUpdates[drawer._id] = count;
      }

      // Count total students for this cabinet
      const cabinetTotal = await db.collection('students').countDocuments({ cabinet: cabinetId });

      // Build the $set payload for all drawer currentCounts
      const setPayload: Record<string, any> = {
        currentCount: cabinetTotal,
        updatedAt: new Date().toISOString(),
      };
      (cabinet.drawers || []).forEach((drawer: any, idx: number) => {
        setPayload[`drawers.${idx}.currentCount`] = drawerUpdates[drawer._id] ?? 0;
      });

      await db.collection('cabinets').updateOne(
        { _id: cabinet._id },
        { $set: setPayload }
      );

      results.push({ cabinet: cabinet.name + (cabinet.identifier ? ` (${cabinet.identifier})` : ''), before: cabinet.currentCount ?? 0, after: cabinetTotal });
      totalCabinets++;
      totalDrawers += (cabinet.drawers || []).length;
    }

    return NextResponse.json({
      success: true,
      totalCabinets,
      totalDrawers,
      results,
    });
  } catch (error) {
    console.error('Sync cabinet counts error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
