import { NextResponse } from 'next/server';
import { requireAdminOrDataLead } from '@/lib/requireSession';
import clientPromise from '@/lib/mongodb';
import { getSystemStats } from '@/lib/systemStats';
import { isMotherDuckConfigured } from '@/lib/motherduck';
import { SEARCH_EVENTS_COLLECTION } from '@/lib/searchAnalytics';
import { escapeRegex } from '@/lib/studentSearch';

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

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildEmptyTrend(days: number): Array<{ date: string; label: string; count: number }> {
  const out: Array<{ date: string; label: string; count: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - i);
    out.push({
      date: dayKey(d),
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      count: 0,
    });
  }
  return out;
}

function mergeTrend(
  empty: Array<{ date: string; label: string; count: number }>,
  rows: Array<{ _id: string; count: number }>,
) {
  const map = new Map(rows.map((r) => [String(r._id).slice(0, 10), r.count]));
  return empty.map((row) => ({
    ...row,
    count: map.get(row.date) || 0,
  }));
}

/** Analytics snapshot for Admin (district) and Data Lead (assigned school). */
export async function GET() {
  const auth = await requireAdminOrDataLead();
  if (!auth.ok) return auth.response;
  const role = auth.user.role;
  const userSchool = auth.user.school?.trim();

  try {
    const client = await clientPromise;
    const db = client.db('student-label');
    const isAdmin = role === 'Admin';
    const schoolFilter =
      !isAdmin && userSchool
        ? { school: { $regex: `^${escapeRegex(userSchool)}$`, $options: 'i' } }
        : {};

    const trendDays = 14;
    const trendStart = new Date();
    trendStart.setHours(0, 0, 0, 0);
    trendStart.setDate(trendStart.getDate() - (trendDays - 1));
    const trendStartIso = trendStart.toISOString();

    const printSchoolFilter =
      isAdmin ? {} : userSchool ? { 'user.school': userSchool } : {};
    const eventSchoolFilter =
      !isAdmin && userSchool
        ? { school: { $regex: `^${escapeRegex(userSchool)}$`, $options: 'i' } }
        : {};
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const nowIso = new Date().toISOString();

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
      byStatusRows,
      enrollmentTrendRows,
      printsTrendRows,
      searchesLast7Days,
      searchesZeroLast7Days,
      searchTrendRows,
      searchByKindRows,
      searchBySourceRows,
      savedSearchCount,
      usersTotal,
      usersLocked,
      usersMfaBypass,
      usersForcePassword,
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
        ...printSchoolFilter,
        time: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() },
      }),
      db.collection('audit_logs').countDocuments({
        time: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() },
      }),
      isAdmin
        ? db.collection('cabinets').find({}).toArray()
        : userSchool
          ? db.collection('cabinets').find({
              school: { $regex: `^${escapeRegex(userSchool)}$`, $options: 'i' },
            }).toArray()
          : [],
      db.collection('students').countDocuments({
        ...schoolFilter,
        archived: { $ne: true },
        $or: [{ cabinet: { $exists: false } }, { cabinet: null }, { cabinet: '' }],
      }),
      db.collection('students').aggregate<{ _id: string; count: number }>([
        { $match: schoolFilter },
        {
          $group: {
            _id: {
              $cond: [
                { $eq: ['$archived', true] },
                'Archived',
                { $ifNull: ['$status', 'Active'] },
              ],
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]).toArray(),
      db.collection('students').aggregate<{ _id: string; count: number }>([
        {
          $match: {
            ...schoolFilter,
            createdAt: { $gte: trendStartIso },
          },
        },
        {
          $group: {
            _id: { $substr: [{ $ifNull: ['$createdAt', ''] }, 0, 10] },
            count: { $sum: 1 },
          },
        },
      ]).toArray(),
      db.collection('print_history').aggregate<{ _id: string; count: number }>([
        {
          $match: {
            ...printSchoolFilter,
            time: { $gte: trendStartIso },
          },
        },
        {
          $group: {
            _id: { $substr: [{ $ifNull: ['$time', ''] }, 0, 10] },
            count: { $sum: 1 },
          },
        },
      ]).toArray(),
      db.collection(SEARCH_EVENTS_COLLECTION).countDocuments({
        ...eventSchoolFilter,
        at: { $gte: sevenDaysAgo },
      }),
      db.collection(SEARCH_EVENTS_COLLECTION).countDocuments({
        ...eventSchoolFilter,
        at: { $gte: sevenDaysAgo },
        zeroResults: true,
      }),
      db.collection(SEARCH_EVENTS_COLLECTION).aggregate<{ _id: string; count: number }>([
        { $match: { ...eventSchoolFilter, at: { $gte: trendStartIso } } },
        { $group: { _id: { $substr: [{ $ifNull: ['$at', ''] }, 0, 10] }, count: { $sum: 1 } } },
      ]).toArray(),
      db.collection(SEARCH_EVENTS_COLLECTION).aggregate<{ _id: string; count: number }>([
        { $match: { ...eventSchoolFilter, at: { $gte: trendStartIso } } },
        { $group: { _id: { $ifNull: ['$kind', 'other'] }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]).toArray(),
      db.collection(SEARCH_EVENTS_COLLECTION).aggregate<{ _id: string; count: number }>([
        { $match: { ...eventSchoolFilter, at: { $gte: trendStartIso } } },
        { $group: { _id: { $ifNull: ['$source', 'lookup'] }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]).toArray(),
      db.collection('saved_searches').estimatedDocumentCount(),
      isAdmin ? db.collection('users').countDocuments() : Promise.resolve(0),
      isAdmin
        ? db.collection('users').countDocuments({ lockedUntil: { $gt: nowIso } })
        : Promise.resolve(0),
      isAdmin ? db.collection('users').countDocuments({ mfaBypass: true }) : Promise.resolve(0),
      isAdmin
        ? db.collection('users').countDocuments({ forcePasswordChange: true })
        : Promise.resolve(0),
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

    const emptyTrend = buildEmptyTrend(trendDays);

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
        byStatus: byStatusRows.map((r) => ({
          status: r._id || 'Unknown',
          count: r.count,
        })),
      },
      enrollment: {
        today: enrollToday,
        week: enrollWeek,
        month: enrollMonth,
        trend: mergeTrend(emptyTrend, enrollmentTrendRows),
      },
      cabinets: {
        total: cabinets.length,
        totalCapacity,
        totalUsed,
        available: Math.max(0, totalCapacity - totalUsed),
        utilizationPercent:
          totalCapacity > 0 ? Math.round((totalUsed / totalCapacity) * 100) : 0,
      },
      activity: {
        printsLast30Days,
        auditLogsLast7Days: auditLast7Days,
        printsTrend: mergeTrend(emptyTrend, printsTrendRows),
      },
      searches: {
        last7Days: searchesLast7Days,
        last14Days: searchTrendRows.reduce((sum, row) => sum + row.count, 0),
        zeroResultsLast7Days: searchesZeroLast7Days,
        zeroResultRate:
          searchesLast7Days > 0
            ? Math.round((searchesZeroLast7Days / searchesLast7Days) * 100)
            : 0,
        savedCount: savedSearchCount,
        trend: mergeTrend(emptyTrend, searchTrendRows),
        byKind: searchByKindRows.map((r) => ({ kind: r._id || 'other', count: r.count })),
        bySource: searchBySourceRows.map((r) => ({ source: r._id || 'lookup', count: r.count })),
      },
      accounts: isAdmin
        ? {
            total: usersTotal,
            locked: usersLocked,
            mfaBypass: usersMfaBypass,
            forcePasswordChange: usersForcePassword,
          }
        : null,
      system: system
        ? {
            databaseConnected: system.database.connected,
            syncReadyPercent: system.students.syncReadyPercent,
            motherduckConfigured:
              system.integrations.some((i) => i.id === 'motherduck' && i.configured)
              || isMotherDuckConfigured(),
          }
        : null,
    });
  } catch (err) {
    console.error('[analytics]', err);
    return NextResponse.json({ error: 'Failed to load analytics' }, { status: 500 });
  }
}
