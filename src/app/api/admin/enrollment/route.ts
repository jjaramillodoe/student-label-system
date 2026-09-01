import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/requireSession';
import clientPromise from '@/lib/mongodb';
import { epeStudentTotalMinutes } from '@/lib/epeClock';
import {
  DEFAULT_INTAKE_SESSION_CONFIGS,
  normalizeIntakeSessions,
  type IntakeSession,
} from '@/lib/intakeSession';
import {
  enrollmentPeriodMongoFilter,
  parseEnrollmentPeriod,
  schoolPeriodStartUtc,
} from '@/lib/enrollmentPeriod';
import { buildEnrollmentInsights } from '@/lib/enrollmentInsights';

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

export async function GET(req: NextRequest) {
  const auth = await requireRole(['Admin', 'Data Lead', 'Data Member']);
  if (!auth.ok) return auth.response;
  const role = auth.user.role;
  const school = auth.user.school;

  const client = await clientPromise;
  const db = client.db('student-label');

  const schoolFilter: Record<string, any> = role !== 'Admin' ? { school } : {};

  const period = parseEnrollmentPeriod(req.nextUrl.searchParams.get('period'));
  const staffFilter = req.nextUrl.searchParams.get('staff') || '';
  const search = req.nextUrl.searchParams.get('search') || '';
  const page = parseInt(req.nextUrl.searchParams.get('page') || '1', 10);
  const limit = 50;
  const now = new Date();

  const todayFilter = enrollmentPeriodMongoFilter(schoolPeriodStartUtc('today', now));
  const weekFilter = enrollmentPeriodMongoFilter(schoolPeriodStartUtc('week', now));
  const monthFilter = enrollmentPeriodMongoFilter(schoolPeriodStartUtc('month', now));
  const yearFilter = enrollmentPeriodMongoFilter(schoolPeriodStartUtc('year', now));

  // ── Metrics: students with a registration or intake visit in each window ──
  const [countToday, countWeek, countMonth, countYear, countAll] = await Promise.all([
    db.collection('students').countDocuments({ ...schoolFilter, ...todayFilter }),
    db.collection('students').countDocuments({ ...schoolFilter, ...weekFilter }),
    db.collection('students').countDocuments({ ...schoolFilter, ...monthFilter }),
    db.collection('students').countDocuments({ ...schoolFilter, ...yearFilter }),
    db.collection('students').countDocuments(schoolFilter),
  ]);

  const periodStart = period === 'all' ? null : schoolPeriodStartUtc(period, now);
  const periodFilter = enrollmentPeriodMongoFilter(periodStart);

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

  const trendStartDate = period === 'all'
    ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    : (periodStart ?? schoolPeriodStartUtc('month', now));

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
    .sort({ updatedAt: -1, createdAt: -1 })
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
    .project({
      createdAt: 1,
      educationStatus: 1,
      intakeSession: 1,
      timeIn: 1,
      timeOut: 1,
      isLeaving: 1,
      intakeVisits: 1,
    })
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

  const insights = buildEnrollmentInsights(timedDocs, {
    periodStart,
    trendStart: trendStartDate,
  });

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
    insights,
    staffBreakdown,
    trend: insights.daily.map(d => ({ date: d.date, count: d.visits })),
    enrollments: enrichedEnrollments,
    schoolIntakeSessions,
    defaultIntakeSessions: DEFAULT_INTAKE_SESSION_CONFIGS,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}
