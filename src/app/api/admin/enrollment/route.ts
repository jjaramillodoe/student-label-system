import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { epeStudentTotalMinutes } from '@/lib/epeClock';
import {
  DEFAULT_INTAKE_SESSION_CONFIGS,
  normalizeIntakeSessions,
  type IntakeSession,
} from '@/lib/intakeSession';

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildEnrollmentSearchFilter(search: string): Record<string, unknown> | null {
  const trimmed = search.trim();
  if (!trimmed) return null;

  const re = { $regex: escapeRegex(trimmed), $options: 'i' };
  const or: Record<string, unknown>[] = [
    { firstName: re },
    { lastName: re },
    { labelId: re },
    { studentId: re },
    { dob: re },
    { 'createdBy.name': re },
    { 'createdBy.email': re },
    { intakeStudentStatus: re },
    { educationStatus: re },
    { placementClass: re },
    { intakeSession: re },
  ];

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const firstRe = { $regex: escapeRegex(parts[0]), $options: 'i' };
    const lastRe = { $regex: escapeRegex(parts.slice(1).join(' ')), $options: 'i' };
    or.push({ $and: [{ firstName: firstRe }, { lastName: lastRe }] });
    or.push({ $and: [{ firstName: lastRe }, { lastName: firstRe }] });
  }

  return { $or: or };
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
  if (!session || !['Admin', 'Data Lead', 'Data Member'].includes(role)) {
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
  const searchFilter = buildEnrollmentSearchFilter(search);
  const listQuery: Record<string, any> = { ...schoolFilter };
  // When searching, look across all enrollments for the school (not just the selected period).
  if (!searchFilter) {
    Object.assign(listQuery, periodFilter);
  }
  if (staffFilter) listQuery['createdBy.email'] = staffFilter;
  if (searchFilter) Object.assign(listQuery, searchFilter);

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
    const mins = epeStudentTotalMinutes(d);
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
    durationMinutes: epeStudentTotalMinutes(e),
    visitCount: Array.isArray(e.intakeVisits) && e.intakeVisits.length
      ? e.intakeVisits.length
      : (e.timeIn ? 1 : 0),
  }));

  const schoolDocs = await db.collection('school_config')
    .find({})
    .project({ name: 1, intakeSessions: 1 })
    .toArray();

  const schoolIntakeSessions: Record<string, IntakeSession[]> = {};
  for (const doc of schoolDocs) {
    if (typeof doc.name !== 'string') continue;
    const sessions = normalizeIntakeSessions(doc.intakeSessions);
    if (sessions.length) schoolIntakeSessions[doc.name] = sessions;
  }

  return NextResponse.json({
    metrics: { today: countToday, week: countWeek, month: countMonth, year: countYear, all: countAll },
    intakeTime: { totalMinutes: totalIntakeMinutes, avgMinutes: avgIntakeMinutes, sessions: timedStudents, visits: totalVisits },
    staffBreakdown,
    trend,
    enrollments: enrichedEnrollments,
    schoolIntakeSessions,
    defaultIntakeSessions: DEFAULT_INTAKE_SESSION_CONFIGS,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}
