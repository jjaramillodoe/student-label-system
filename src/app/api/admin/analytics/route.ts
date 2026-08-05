import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import clientPromise from '@/lib/mongodb';
import { getSystemStats } from '@/lib/systemStats';

export const dynamic = 'force-dynamic';

function startOf(period: 'today' | 'week' | 'month'): Date {
  const d = new Date();
  if (period === 'today') {
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === 'week') {
    const day = d.getDay();
    const diff = day === 0 ? 6 : day - 1;
    d.setDate(d.getDate() - diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Analytics snapshot for Admin (district) and Data Lead (assigned school). */
export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userSchool = (session?.user as { school?: string })?.school?.trim();

  if (!session || !['Admin', 'Data Lead'].includes(role || '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const client = await clientPromise;
    const db = client.db('student-label');
    const isAdmin = role === 'Admin';
    const schoolFilter =
      !isAdmin && userSchool
        ? { school: { $regex: `^${userSchool.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }
        : {};

    const [
      studentsTotal,
      studentsActive,
      studentsArchived,
      enrollToday,
      enrollWeek,
      enrollMonth,
      printsLast30Days,
      auditLast7Days,
      cabinets,
      unassigned,
    ] = await Promise.all([
      db.collection('students').countDocuments(schoolFilter),
      db.collection('students').countDocuments({ ...schoolFilter, archived: { $ne: true } }),
      db.collection('students').countDocuments({ ...schoolFilter, archived: true }),
      db.collection('students').countDocuments({
        ...schoolFilter,
        createdAt: { $gte: startOf('today').toISOString() },
      }),
      db.collection('students').countDocuments({
        ...schoolFilter,
        createdAt: { $gte: startOf('week').toISOString() },
      }),
      db.collection('students').countDocuments({
        ...schoolFilter,
        createdAt: { $gte: startOf('month').toISOString() },
      }),
      db.collection('print_history').countDocuments({
        ...(isAdmin ? {} : userSchool ? { 'user.school': userSchool } : {}),
        time: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() },
      }),
      db.collection('audit_logs').countDocuments({
        time: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() },
      }),
      isAdmin
        ? db.collection('cabinets').find({}).toArray()
        : userSchool
          ? db.collection('cabinets').find({
              school: { $regex: `^${userSchool.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
            }).toArray()
          : [],
      db.collection('students').countDocuments({
        ...schoolFilter,
        archived: { $ne: true },
        $or: [{ cabinet: { $exists: false } }, { cabinet: null }, { cabinet: '' }],
      }),
    ]);

    const totalCapacity = cabinets.reduce((sum, c) => sum + (c.totalCapacity || 0), 0);
    const totalUsed = cabinets.reduce((sum, c) => sum + (c.currentCount || 0), 0);

    let bySchool: Array<{ school: string; count: number }> = [];
    if (isAdmin) {
      bySchool = await db
        .collection('students')
        .aggregate<{ _id: string; count: number }>([
          { $group: { _id: { $ifNull: ['$school', '(none)'] }, count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 12 },
        ])
        .toArray()
        .then((rows) => rows.map((r) => ({ school: r._id || '(none)', count: r.count })));
    }

    let system: Awaited<ReturnType<typeof getSystemStats>> | null = null;
    if (isAdmin) {
      try {
        system = await getSystemStats();
      } catch {
        system = null;
      }
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      scope: isAdmin ? 'district' : 'school',
      school: isAdmin ? null : userSchool || null,
      students: {
        total: studentsTotal,
        active: studentsActive,
        archived: studentsArchived,
        unassigned,
        bySchool,
      },
      enrollment: {
        today: enrollToday,
        week: enrollWeek,
        month: enrollMonth,
      },
      cabinets: {
        total: cabinets.length,
        totalCapacity,
        totalUsed,
        utilizationPercent:
          totalCapacity > 0 ? Math.round((totalUsed / totalCapacity) * 100) : 0,
      },
      activity: {
        printsLast30Days,
        auditLogsLast7Days: auditLast7Days,
      },
      system: system
        ? {
            databaseConnected: system.database.connected,
            syncReadyPercent: system.students.syncReadyPercent,
            thoughtspotConfigured: system.integrations.some(
              (i) => i.id === 'thoughtspot' && i.configured,
            ),
          }
        : null,
    });
  } catch (err) {
    console.error('[analytics]', err);
    return NextResponse.json({ error: 'Failed to load analytics' }, { status: 500 });
  }
}
