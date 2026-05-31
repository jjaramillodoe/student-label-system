import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';

// Parse an "HH:MM" time string into minutes-of-day. Returns null if invalid.
function parseMinutes(t: unknown): number | null {
  if (typeof t !== 'string') return null;
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (isNaN(h) || isNaN(min)) return null;
  return h * 60 + min;
}

// Duration between time-in and time-out in minutes (handles past-midnight rollover).
function intakeDurationMinutes(timeIn: unknown, timeOut: unknown): number | null {
  const a = parseMinutes(timeIn);
  const b = parseMinutes(timeOut);
  if (a === null || b === null) return null;
  let diff = b - a;
  if (diff < 0) diff += 24 * 60; // crossed midnight
  return diff;
}

// Total intake minutes for a student across ALL recorded visits.
// Falls back to the top-level timeIn/timeOut for legacy records without a visit log.
function studentTotalMinutes(doc: any): number | null {
  if (Array.isArray(doc?.intakeVisits) && doc.intakeVisits.length) {
    let total = 0;
    let counted = false;
    for (const v of doc.intakeVisits) {
      const mins = intakeDurationMinutes(v?.timeIn, v?.timeOut);
      if (mins !== null) { total += mins; counted = true; }
    }
    return counted ? total : null;
  }
  return intakeDurationMinutes(doc?.timeIn, doc?.timeOut);
}

function startOf(unit: 'today' | 'week' | 'month' | 'year'): Date {
  const now = new Date();
  if (unit === 'today') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (unit === 'week') {
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day; // Monday
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
  }
  if (unit === 'month') {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  // year
  return new Date(now.getFullYear(), 0, 1);
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  const school = (session?.user as any)?.school;
  if (!session || !['Admin', 'Data Lead'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const client = await clientPromise;
  const db = client.db('student-label');

  const schoolFilter: Record<string, any> = role !== 'Admin' ? { school } : {};

  // Optional period filter from query param
  const period = req.nextUrl.searchParams.get('period') || 'month'; // today|week|month|year|all
  const staffFilter = req.nextUrl.searchParams.get('staff') || '';
  const search = req.nextUrl.searchParams.get('search') || '';
  const page = parseInt(req.nextUrl.searchParams.get('page') || '1', 10);
  const limit = 50;

  // ── Metrics: counts for each time window ──────────────────────────────────
  const [countToday, countWeek, countMonth, countYear, countAll] = await Promise.all([
    db.collection('students').countDocuments({ ...schoolFilter, createdAt: { $gte: startOf('today').toISOString() } }),
    db.collection('students').countDocuments({ ...schoolFilter, createdAt: { $gte: startOf('week').toISOString() } }),
    db.collection('students').countDocuments({ ...schoolFilter, createdAt: { $gte: startOf('month').toISOString() } }),
    db.collection('students').countDocuments({ ...schoolFilter, createdAt: { $gte: startOf('year').toISOString() } }),
    db.collection('students').countDocuments(schoolFilter),
  ]);

  // ── Staff leaderboard: count by createdBy.email for current period ─────────
  const periodStart = period === 'all' ? null : startOf(period as any).toISOString();
  const periodFilter = periodStart ? { createdAt: { $gte: periodStart } } : {};

  const staffAgg = await db.collection('students').aggregate([
    { $match: { ...schoolFilter, ...periodFilter } },
    {
      $group: {
        _id: { email: '$createdBy.email', name: '$createdBy.name' },
        count: { $sum: 1 },
        lastAt: { $max: '$createdAt' },
      },
    },
    { $sort: { count: -1 } },
  ]).toArray();

  const staffBreakdown = staffAgg.map(r => ({
    email: r._id.email || 'Unknown',
    name: r._id.name || r._id.email || 'Unknown',
    count: r.count,
    lastAt: r.lastAt,
  }));

  // ── Daily trend: enrollments per day for current period (last 30 days max) ─
  const trendStart = period === 'all'
    ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    : (periodStart ?? startOf('month').toISOString());

  const trendAgg = await db.collection('students').aggregate([
    { $match: { ...schoolFilter, createdAt: { $gte: trendStart } } },
    {
      $group: {
        _id: { $substr: ['$createdAt', 0, 10] }, // YYYY-MM-DD
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]).toArray();

  const trend = trendAgg.map(r => ({ date: r._id, count: r.count }));

  // ── Paginated enrollment list ──────────────────────────────────────────────
  const listQuery: Record<string, any> = { ...schoolFilter, ...periodFilter };
  if (staffFilter) listQuery['createdBy.email'] = staffFilter;
  if (search) {
    const re = { $regex: search, $options: 'i' };
    listQuery.$or = [{ firstName: re }, { lastName: re }, { 'createdBy.name': re }];
  }

  const total = await db.collection('students').countDocuments(listQuery);
  const enrollments = await db.collection('students')
    .find(listQuery)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .project({
      firstName: 1, lastName: 1, dob: 1, school: 1,
      status: 1, createdAt: 1, createdBy: 1,
      labelId: 1, studentId: 1, program: 1,
      siblingFlag: 1, siblingConfirmed: 1,
      cabinet: 1, drawer: 1,
      // Intake fields
      intakeStudentStatus: 1, educationStatus: 1, intakeActivity: 1,
      placementClass: 1, intakeSession: 1, timeIn: 1, timeOut: 1, isLeaving: 1,
      intakeVisits: 1,
    })
    .toArray();

  // ── Total intake time across the filtered query (all pages, all visits) ────
  const timedDocs = await db.collection('students')
    .find(listQuery)
    .project({ timeIn: 1, timeOut: 1, intakeVisits: 1 })
    .toArray();

  let totalIntakeMinutes = 0;
  let timedStudents = 0;
  let totalVisits = 0;
  for (const d of timedDocs) {
    const mins = studentTotalMinutes(d);
    const visitCount = Array.isArray(d.intakeVisits) && d.intakeVisits.length
      ? d.intakeVisits.length
      : (d.timeIn ? 1 : 0);
    totalVisits += visitCount;
    if (mins !== null && mins > 0) { totalIntakeMinutes += mins; timedStudents += 1; }
  }
  const avgIntakeMinutes = timedStudents > 0 ? Math.round(totalIntakeMinutes / timedStudents) : 0;

  const enrichedEnrollments = enrollments.map(e => ({
    ...e,
    _id: e._id.toString(),
    durationMinutes: studentTotalMinutes(e),
    visitCount: Array.isArray(e.intakeVisits) && e.intakeVisits.length
      ? e.intakeVisits.length
      : (e.timeIn ? 1 : 0),
  }));

  return NextResponse.json({
    metrics: { today: countToday, week: countWeek, month: countMonth, year: countYear, all: countAll },
    intakeTime: { totalMinutes: totalIntakeMinutes, avgMinutes: avgIntakeMinutes, sessions: timedStudents, visits: totalVisits },
    staffBreakdown,
    trend,
    enrollments: enrichedEnrollments,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}
