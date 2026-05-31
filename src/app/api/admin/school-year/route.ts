import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import clientPromise from '@/lib/mongodb';
import { getCurrentFiscalYear } from '@/lib/fiscalYear';
import { countPendingArchiveAssignments } from '@/lib/archiveBoxes';
import { ObjectId } from 'mongodb';

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

type ChecklistItem = {
  id: string;
  title: string;
  description: string;
  status: 'complete' | 'warning' | 'action';
  href?: string;
  detail?: string;
};

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as { role?: string })?.role;
    const userSchool = (session?.user as { school?: string })?.school?.trim();

    if (!session || (userRole !== 'Admin' && userRole !== 'Data Lead')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const client = await clientPromise;
    const db = client.db('student-label');
    const scopedQuery = userRole !== 'Admin' && userSchool ? { school: userSchool } : {};

    const [cabinets, schoolDoc, badAssignmentCount, activeWithoutDrawer] = await Promise.all([
      db.collection('cabinets').find(scopedQuery).toArray(),
      userSchool
        ? db.collection('school_config').findOne({
            name: { $regex: `^${escapeRegex(userSchool)}$`, $options: 'i' },
          })
        : null,
      db.collection('students').countDocuments({
        ...scopedQuery,
        $or: [
          { cabinet: { $exists: false } },
          { cabinet: null },
          { cabinet: '' },
        ],
        archived: { $ne: true },
        status: { $ne: 'Archived' },
      }),
      db.collection('students').countDocuments({
        ...scopedQuery,
        status: 'Active',
        archived: { $ne: true },
        $or: [
          { cabinet: { $exists: false } },
          { cabinet: null },
          { cabinet: '' },
        ],
      }),
    ]);

    const systemFiscalYear = getCurrentFiscalYear();
    const configuredFiscalYear =
      typeof schoolDoc?.currentFiscalYear === 'string' && schoolDoc.currentFiscalYear.trim()
        ? schoolDoc.currentFiscalYear.trim()
        : null;

    const activeCabinets = cabinets.filter(c => c.status !== 'Archived');
    const archivedCabinets = cabinets.filter(c => c.status === 'Archived');
    const fullActiveCabinets = activeCabinets.filter(
      c => (c.totalCapacity || 0) > 0 && (c.currentCount || 0) >= (c.totalCapacity || 0),
    );
    const openActiveCabinets = activeCabinets.filter(
      c => (c.currentCount || 0) < (c.totalCapacity || 0),
    );

    let pendingArchiveTotal = 0;
    for (const cabinet of archivedCabinets) {
      if (!cabinet.archiveRecordId) continue;
      try {
        const archiveRecord = await db.collection('cabinet_archives').findOne({
          _id: new ObjectId(cabinet.archiveRecordId),
        });
        const physicalBoxes = archiveRecord?.physicalBoxes ?? [];
        pendingArchiveTotal += await countPendingArchiveAssignments(
          db,
          cabinet._id.toString(),
          cabinet.archiveRecordId,
          physicalBoxes,
        );
      } catch {
        // skip invalid archive refs
      }
    }

    const hasIntakeSessions =
      Array.isArray(schoolDoc?.intakeSessions) && schoolDoc.intakeSessions.length > 0;
    const hasIntakeActivities =
      Array.isArray(schoolDoc?.intakeActivities) && schoolDoc.intakeActivities.length > 0;

    const checklist: ChecklistItem[] = [
      {
        id: 'archive-full-cabinets',
        title: 'Archive cabinets from the ending year',
        description:
          'Archive each cabinet for the closing school year — full or partially filled. Use end-of-year closeout when drawers are not full.',
        status: fullActiveCabinets.length === 0 ? 'complete' : 'action',
        href: '/admin/cabinets',
        detail:
          fullActiveCabinets.length === 0
            ? `${archivedCabinets.length} archived cabinet(s) on record`
            : `${fullActiveCabinets.length} active cabinet(s) still at capacity`,
      },
      {
        id: 'active-cabinet-space',
        title: 'Create an active cabinet with open drawer space',
        description:
          'Intake and returning students need at least one active cabinet that is not full.',
        status: openActiveCabinets.length > 0 ? 'complete' : 'action',
        href: '/admin/cabinets',
        detail:
          openActiveCabinets.length > 0
            ? `${openActiveCabinets.length} active cabinet(s) with available space`
            : 'No active cabinets with space — add a new cabinet for the new year',
      },
      {
        id: 'fiscal-year',
        title: 'Set the current fiscal year for intake',
        description:
          'Intake registrations use this year. It should match the new school year (e.g. 2026-2027).',
        status: configuredFiscalYear
          ? configuredFiscalYear === systemFiscalYear
            ? 'complete'
            : 'warning'
          : 'warning',
        href: '/admin/schools',
        detail: configuredFiscalYear
          ? `Configured: ${configuredFiscalYear}${configuredFiscalYear !== systemFiscalYear ? ` (calendar default: ${systemFiscalYear})` : ''}`
          : `Using calendar default: ${systemFiscalYear} — save an explicit year in School Settings`,
      },
      {
        id: 'intake-settings',
        title: 'Review intake sessions and activities',
        description: 'Confirm session names and activity checkboxes match the new year.',
        status: hasIntakeSessions && hasIntakeActivities ? 'complete' : 'warning',
        href: '/admin/schools',
        detail:
          hasIntakeSessions && hasIntakeActivities
            ? 'Custom intake sessions and activities are configured'
            : 'Using system defaults — customize in School Settings if needed',
      },
      {
        id: 'archive-box-sync',
        title: 'Sync archived students into archive boxes',
        description:
          'Every archived student file should have an archive box location for lookup and QR scanning.',
        status: pendingArchiveTotal === 0 ? 'complete' : 'action',
        href: '/admin/cabinets',
        detail:
          pendingArchiveTotal === 0
            ? 'All archived students are linked to boxes'
            : `${pendingArchiveTotal} student file(s) still need box assignment`,
      },
      {
        id: 'cabinet-health',
        title: 'Clear cabinet health issues',
        description:
          'Active students should have valid cabinet/drawer assignments; archived students should not appear as missing.',
        status: badAssignmentCount === 0 ? 'complete' : 'action',
        href: '/admin/cabinet-health',
        detail:
          badAssignmentCount === 0
            ? 'No active students missing cabinet assignments'
            : `${badAssignmentCount} active student(s) missing cabinet assignments`,
      },
    ];

    const readyCount = checklist.filter(item => item.status === 'complete').length;

    return NextResponse.json({
      school: userSchool ?? null,
      systemFiscalYear,
      configuredFiscalYear: configuredFiscalYear ?? systemFiscalYear,
      summary: {
        activeCabinets: activeCabinets.length,
        archivedCabinets: archivedCabinets.length,
        fullActiveCabinets: fullActiveCabinets.length,
        openActiveCabinets: openActiveCabinets.length,
        pendingArchiveAssignments: pendingArchiveTotal,
        activeStudentsWithoutDrawer: activeWithoutDrawer,
        checklistComplete: readyCount,
        checklistTotal: checklist.length,
      },
      checklist,
    });
  } catch (error) {
    console.error('Error fetching school year rollover status:', error);
    return NextResponse.json({ error: 'Failed to load rollover checklist' }, { status: 500 });
  }
}
