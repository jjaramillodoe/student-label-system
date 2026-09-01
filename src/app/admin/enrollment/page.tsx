'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PageIntro from '@/components/PageIntro';
import {
  UserPlus, Users, Clock, TrendingUp,
  RefreshCw, Loader2, Search, Filter, ChevronLeft, ChevronRight,
  Medal, Award, Star, AlertTriangle, Link2,
  ChevronDown, ChevronUp, Wrench,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  epeVisitDurationMinutes,
  epeVisitsTotalMinutes,
  fmtEpeTimeStr,
  isEpeAdjusted,
} from '@/lib/epeClock';
import {
  validateIntakeVisits,
  flagsForVisit,
  INTAKE_FLAG_LABELS,
  primaryIntakeIssueLabel,
  type IntakeVisitValidation,
  type IntakeVisitFlag,
} from '@/lib/intakeVisitValidation';
import { DEFAULT_INTAKE_SESSION_CONFIGS, type IntakeSession } from '@/lib/intakeDefaults';
import { resolveSchoolIntakeSessions } from '@/lib/intakeIssues';
import { canFixIntakeHandoff } from '@/lib/intakeVisitFix';
import IntakeIssuesBanner from '@/components/IntakeIssuesBanner';
import IntakeHandoffFixDialog from '@/components/IntakeHandoffFixDialog';
import EnrollmentInsightsPanel, { EnrollmentDailyTrendChart } from '@/components/EnrollmentInsightsPanel';
import { formatFullName } from '@/lib/personName';
import type { EnrollmentInsights } from '@/lib/enrollmentInsights';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Metrics {
  today: number;
  week: number;
  month: number;
  year: number;
  all: number;
}
interface IntakeTime { totalMinutes: number; avgMinutes: number; sessions: number; visits: number; }
interface StaffMember { email: string; name: string; count: number; lastAt: string; }
interface Enrollment {
  _id: string;
  firstName: string;
  lastName: string;
  dob: string;
  school?: string;
  status?: string;
  createdAt: string;
  createdBy?: { name: string; email: string };
  labelId?: string;
  studentId?: string;
  program?: string;
  siblingFlag?: boolean;
  siblingConfirmed?: boolean;
  // Intake fields
  intakeStudentStatus?: string;
  educationStatus?: string;
  intakeActivity?: string[];
  placementClass?: string;
  intakeSession?: string;
  timeIn?: string;
  timeOut?: string;
  isLeaving?: string;
  durationMinutes?: number | null;
  visitCount?: number;
  intakeVisits?: IntakeVisit[];
}

interface IntakeVisit {
  date?: string;
  timeIn?: string;
  timeOut?: string | null;
  isLeaving?: string;
  intakeSession?: string;
  intakeActivity?: string[];
  educationStatus?: string;
  placementClass?: string;
  notes?: string;
  recordedBy?: { name?: string; email?: string };
}
interface Pagination { page: number; limit: number; total: number; pages: number; }

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtTime(iso: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
function initials(name: string) {
  return name.split(/\s+/).map(w => w[0] ?? '').join('').toUpperCase().slice(0, 2);
}
// Format an "HH:MM" 24h time string into a friendly 12h time.
function fmtTimeStr(t?: string) {
  if (!t) return '—';
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return t;
  const h = parseInt(m[1], 10);
  const min = m[2];
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${min} ${period}`;
}
// Format a minute count as "1h 25m (85 min)".
function fmtDuration(mins?: number | null) {
  if (mins === null || mins === undefined) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const human = h > 0 ? `${h}h ${m}m` : `${m}m`;
  return `${human} (${mins} min)`;
}
// Compact total like "12h 30m".
function fmtTotalHM(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}
function epeTimeTitle(t?: string) {
  if (!t || !isEpeAdjusted(t)) return undefined;
  return `Actual: ${fmtTimeStr(t)} · EPE: ${fmtEpeTimeStr(t)}`;
}
function getVisitHistory(e: Enrollment): IntakeVisit[] {
  if (Array.isArray(e.intakeVisits) && e.intakeVisits.length > 0) {
    return [...e.intakeVisits].sort(
      (a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime(),
    );
  }
  if (e.timeIn) {
    return [{
      date: e.createdAt,
      timeIn: e.timeIn,
      timeOut: e.timeOut ?? null,
      isLeaving: e.isLeaving,
      intakeSession: e.intakeSession,
      intakeActivity: e.intakeActivity,
      educationStatus: e.educationStatus,
      placementClass: e.placementClass,
      recordedBy: e.createdBy,
    }];
  }
  return [];
}

/** Prefer the latest intakeVisits entry; fall back to top-level fields for legacy rows. */
function resolveLatestIntakeDisplay(e: Enrollment) {
  const visits = getVisitHistory(e);
  const latest = visits.length ? visits[visits.length - 1] : null;
  return {
    educationStatus: latest?.educationStatus ?? e.educationStatus,
    intakeActivity: latest?.intakeActivity ?? e.intakeActivity,
    placementClass: latest?.placementClass ?? e.placementClass,
    intakeSession: latest?.intakeSession ?? e.intakeSession,
    timeIn: latest?.timeIn ?? e.timeIn,
    timeOut: latest?.timeOut ?? e.timeOut,
    isLeaving: latest?.isLeaving ?? e.isLeaving,
  };
}
const RANK_COLORS = [
  'bg-yellow-100 text-yellow-700 border-yellow-300',
  'bg-slate-100 text-slate-600 border-slate-300',
  'bg-orange-100 text-orange-700 border-orange-300',
];
const RANK_ICONS = [
  <Medal key={0} className="h-3.5 w-3.5 text-yellow-500" />,
  <Award key={1} className="h-3.5 w-3.5 text-slate-500" />,
  <Star key={2} className="h-3.5 w-3.5 text-orange-500" />,
];

function validateEnrollmentVisits(
  enrollment: Enrollment,
  schoolSessionMap: Record<string, IntakeSession[]>,
  defaultSessions: IntakeSession[],
) {
  return validateIntakeVisits(getVisitHistory(enrollment), {
    sessionConfigs: resolveSchoolIntakeSessions(
      enrollment.school,
      schoolSessionMap,
      defaultSessions,
    ),
  });
}

function IntakeFlagBadge({ flag }: { flag: IntakeVisitFlag }) {
  const style =
    flag.type === 'outside_session_window'
      ? 'ui-badge-info'
      : flag.type === 'overlapping_times' || flag.type === 'missing_final_clock_out'
        ? 'ui-badge-danger'
        : 'ui-badge-warning';
  return (
    <span title={flag.message} className={`${style} text-[10px]`}>
      <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
      {INTAKE_FLAG_LABELS[flag.type]}
    </span>
  );
}

function IntakeVisitHistory({
  visits,
  validation,
}: {
  visits: IntakeVisit[];
  validation: IntakeVisitValidation;
}) {
  if (visits.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">No intake visit history recorded.</p>
    );
  }
  return (
    <div className="space-y-3">
      {validation.dayIssues.map(issue => (
        <div
          key={issue.dayKey}
          className="rounded-md border border-amber-300 bg-amber-50/80 dark:bg-amber-950/20 dark:border-amber-800 px-3 py-2 text-xs text-amber-900 dark:text-amber-100"
        >
          <p className="font-medium flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {issue.missingFinalClockOut ? 'Missing Time-Out' : 'Intake issue'} — {issue.dayLabel}
          </p>
          <ul className="mt-1 list-disc list-inside space-y-0.5 text-amber-800/90 dark:text-amber-200/90">
            {issue.messages.map(msg => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
        </div>
      ))}
      <div className="rounded-md border bg-background overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-10 text-xs">#</TableHead>
            <TableHead className="text-xs">Date</TableHead>
            <TableHead className="text-xs">Time in (EPE)</TableHead>
            <TableHead className="text-xs">Time out (EPE)</TableHead>
            <TableHead className="text-xs">Duration (EPE)</TableHead>
            <TableHead className="text-xs">BE/ESL</TableHead>
            <TableHead className="text-xs">Session</TableHead>
            <TableHead className="text-xs">Activity</TableHead>
            <TableHead className="text-xs">Leaving</TableHead>
            <TableHead className="text-xs">Flags</TableHead>
            <TableHead className="text-xs">Recorded by</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visits.map((v, i) => {
            const mins = epeVisitDurationMinutes(v.timeIn, v.timeOut);
            const rowFlags = flagsForVisit(validation, i);
            const flagged = rowFlags.length > 0;
            return (
              <TableRow
                key={`${v.date}-${i}`}
                className={flagged ? 'bg-amber-50/60 dark:bg-amber-950/15' : undefined}
              >
                <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                <TableCell className="text-xs whitespace-nowrap">
                  {v.date
                    ? new Date(v.date).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })
                    : '—'}
                </TableCell>
                <TableCell className="text-xs" title={epeTimeTitle(v.timeIn)}>
                  {fmtEpeTimeStr(v.timeIn)}
                </TableCell>
                <TableCell className="text-xs">
                  {v.isLeaving === 'Staying'
                    ? <span className="italic text-muted-foreground">Staying</span>
                    : (
                      <span title={epeTimeTitle(v.timeOut ?? undefined)}>
                        {fmtEpeTimeStr(v.timeOut ?? undefined)}
                      </span>
                    )}
                </TableCell>
                <TableCell className="text-xs font-medium">
                  {mins != null ? fmtTotalHM(mins) : '—'}
                </TableCell>
                <TableCell className="text-xs">
                  {v.educationStatus
                    ? <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{v.educationStatus}</Badge>
                    : '—'}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[140px]">
                  {v.intakeSession || '—'}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[200px]">
                  {v.intakeActivity?.length ? v.intakeActivity.join(', ') : '—'}
                </TableCell>
                <TableCell className="text-xs">
                  {v.isLeaving
                    ? <Badge variant="outline" className="text-[10px] px-1.5 py-0">{v.isLeaving}</Badge>
                    : '—'}
                </TableCell>
                <TableCell className="text-xs">
                  {rowFlags.length > 0
                    ? (
                      <div className="flex flex-col gap-1 max-w-[160px]">
                        {rowFlags.map((flag, fi) => (
                          <IntakeFlagBadge key={`${flag.type}-${fi}`} flag={flag} />
                        ))}
                      </div>
                    )
                    : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-xs">
                  {v.recordedBy?.name || v.recordedBy?.email || '—'}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function EnrollmentPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();

  const [period, setPeriod] = useState('month');
  const [staffFilter, setStaffFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [intakeTime, setIntakeTime] = useState<IntakeTime | null>(null);
  const [insights, setInsights] = useState<EnrollmentInsights | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [schoolSessionMap, setSchoolSessionMap] = useState<Record<string, IntakeSession[]>>({});
  const [defaultIntakeSessions, setDefaultIntakeSessions] = useState<IntakeSession[]>(
    DEFAULT_INTAKE_SESSION_CONFIGS,
  );
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [issuesOnly, setIssuesOnly] = useState(false);
  const [issuesRefresh, setIssuesRefresh] = useState(0);
  const [fixTarget, setFixTarget] = useState<{ id: string; name: string } | null>(null);

  const role = (session?.user as any)?.role ?? '';
  const school = (session?.user as any)?.school ?? '';
  const canAccess = ['Admin', 'Data Lead', 'Data Member'].includes(role);
  const canFix = canFixIntakeHandoff(role);
  const isAdmin = role === 'Admin';
  const tableColSpan = 13;

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.replace('/admin');
    if (authStatus === 'authenticated' && !canAccess) {
      router.replace('/admin');
    }
  }, [authStatus, canAccess, router]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('issuesOnly') === '1') setIssuesOnly(true);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ period, page: String(page) });
      if (staffFilter) params.set('staff', staffFilter);
      if (search) params.set('search', search);
      const res = await fetch(`/api/admin/enrollment?${params}`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setMetrics(data.metrics);
      setIntakeTime(data.intakeTime ?? null);
      setInsights(data.insights ?? null);
      setStaff(data.staffBreakdown || []);
      setEnrollments(data.enrollments || []);
      setSchoolSessionMap(data.schoolIntakeSessions || {});
      if (Array.isArray(data.defaultIntakeSessions) && data.defaultIntakeSessions.length) {
        setDefaultIntakeSessions(data.defaultIntakeSessions);
      }
      setPagination(data.pagination);
    } catch {
      setError('Failed to load enrollment data.');
    } finally {
      setLoading(false);
    }
  }, [period, staffFilter, search, page]);

  useEffect(() => {
    if (authStatus === 'authenticated') load();
  }, [authStatus, load]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
    setExpandedId(null);
  }, [period, staffFilter, search]);

  if (authStatus === 'loading') return null;

  const displayedEnrollments = (() => {
    const list = issuesOnly
      ? enrollments.filter(e =>
          validateEnrollmentVisits(e, schoolSessionMap, defaultIntakeSessions).hasIssues,
        )
      : enrollments;
    return [...list].sort((a, b) => {
      const aVal = validateEnrollmentVisits(a, schoolSessionMap, defaultIntakeSessions);
      const bVal = validateEnrollmentVisits(b, schoolSessionMap, defaultIntakeSessions);
      const aMissing = aVal.flags.some(f => f.type === 'missing_final_clock_out');
      const bMissing = bVal.flags.some(f => f.type === 'missing_final_clock_out');
      if (aMissing !== bMissing) return aMissing ? -1 : 1;
      if (aVal.hasIssues !== bVal.hasIssues) return aVal.hasIssues ? -1 : 1;
      return 0;
    });
  })();

  const handleFixed = () => {
    setIssuesRefresh(n => n + 1);
    load();
  };

  const PERIOD_CARDS = metrics ? [
    { key: 'today' as const, label: 'Today', value: metrics.today, hint: 'Students with activity today' },
    { key: 'week' as const, label: 'This Week', value: metrics.week, hint: 'Monday–today' },
    { key: 'month' as const, label: 'This Month', value: metrics.month, hint: 'New files + returning visits' },
    { key: 'all' as const, label: 'All Time', value: metrics.all, hint: 'Every student file' },
  ] : [];

  const maxStaffCount = Math.max(...staff.map(s => s.count), 1);

  return (
    <div className="w-full space-y-6">

        {canFix && (
          <IntakeIssuesBanner
            reviewHref="/admin/enrollment?issuesOnly=1"
            refreshToken={issuesRefresh}
          />
        )}

        <PageIntro
          eyebrow="Students"
          title="Enrollments"
          description={
            isAdmin
              ? 'Search registrations and returning visits, review intake time, and filter by staff or school.'
              : `Search registrations and returning visits for ${school || 'your school'}.`
          }
          icon={<UserPlus className="h-5 w-5 text-primary" />}
          actions={
            <>
              {isAdmin && (
                <Button variant="outline" size="sm" asChild>
                  <Link href="/admin/motherduck-analytics" className="gap-2">
                    <TrendingUp className="h-4 w-4" />
                    MotherDuck Analytics
                  </Link>
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </>
          }
        />

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* ── Activity period counts ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {loading && !metrics
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[72px] w-full" />)
            : PERIOD_CARDS.map(m => (
              <button
                key={m.key}
                type="button"
                onClick={() => setPeriod(m.key)}
                className={cn(
                  'rounded-lg border px-4 py-3 text-left transition-colors',
                  period === m.key
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-muted/30 hover:bg-muted/50',
                )}
              >
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{m.label}</p>
                <p className="text-xl font-semibold tabular-nums tracking-tight">{m.value.toLocaleString()}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{m.hint}</p>
              </button>
            ))}
        </div>

        <EnrollmentInsightsPanel insights={insights} loading={loading} />

        {/* ── Intake time summary ── */}
        {intakeTime && (
          <div className="flex flex-wrap gap-x-8 gap-y-3 rounded-lg border border-border px-4 py-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total intake time (EPE)</p>
              <p className="text-xl font-semibold tabular-nums tracking-tight">{fmtTotalHM(intakeTime.totalMinutes)}</p>
              <p className="text-[11px] text-muted-foreground">{intakeTime.totalMinutes.toLocaleString()} minutes</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Avg per student</p>
              <p className="text-xl font-semibold tabular-nums tracking-tight">{fmtTotalHM(intakeTime.avgMinutes)}</p>
              <p className="text-[11px] text-muted-foreground">{intakeTime.avgMinutes} min · all visits</p>
            </div>
            <div className="max-w-md">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">EPE rounding</p>
              <p className="text-xs text-muted-foreground mt-1">
                :00–:14 → :00 · :15–:44 → :30 · :45–:59 → next hour. Hover a time in the table for actual vs EPE.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Staff leaderboard ── */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> Staff Registrations
              </CardTitle>
              <CardDescription>Students with a registration or visit in this period</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading && staff.length === 0
                ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
                : staff.length === 0
                  ? <p className="text-sm text-muted-foreground italic py-4 text-center">No data for this period.</p>
                  : staff.map((s, i) => (
                    <button
                      key={s.email}
                      onClick={() => setStaffFilter(staffFilter === s.email ? '' : s.email)}
                      className={`w-full text-left rounded-lg border px-3 py-2 transition-colors hover:bg-muted/40 ${
                        staffFilter === s.email ? 'border-primary bg-primary/5' : 'border-border'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold shrink-0 ${
                          i < 3 ? RANK_COLORS[i] : 'bg-muted text-muted-foreground border-border'
                        }`}>
                          {i < 3 ? RANK_ICONS[i] : i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium truncate">{s.name}</span>
                            <span className="text-sm font-bold text-primary shrink-0">{s.count}</span>
                          </div>
                          <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary/60 transition-all"
                              style={{ width: `${(s.count / maxStaffCount) * 100}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                            {s.email} · Last: {fmtDate(s.lastAt)}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
              }
              {staffFilter && (
                <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setStaffFilter('')}>
                  Clear staff filter
                </Button>
              )}
            </CardContent>
          </Card>

          {/* ── Daily trend ── */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Daily activity
              </CardTitle>
              <CardDescription>
                New files vs intake visits{period === 'all' ? ' · last 30 days' : ' · follows the period filter'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EnrollmentDailyTrendChart daily={insights?.daily ?? []} loading={loading} />
            </CardContent>
          </Card>
        </div>

        {/* ── Enrollment list ── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Filter className="h-4 w-4 text-primary" /> Enrollment Records
                </CardTitle>
                {pagination && (
                  <CardDescription>
                    {pagination.total.toLocaleString()} total · page {pagination.page} of {pagination.pages}
                    {' '}· period includes new registrations and returning visits
                  </CardDescription>
                )}
              </div>

              {/* Filters row */}
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger className="w-36 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">This Week</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                    <SelectItem value="year">This Year</SelectItem>
                    <SelectItem value="all">All Time</SelectItem>
                  </SelectContent>
                </Select>

                <div className="relative min-w-[220px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={searchInput}
                    onChange={e => setSearchInput(e.target.value)}
                    placeholder="Name, label ID, student ID, staff…"
                    className="pl-8 h-8 text-xs w-full sm:w-64"
                    aria-label="Search enrollments"
                  />
                </div>
                {search && (
                  <p className="text-[11px] text-muted-foreground w-full">
                    Searching all enrollments for your school (period filter ignored while searching).
                  </p>
                )}
                {canFix && (
                  <Button
                    type="button"
                    variant={issuesOnly ? 'default' : 'outline'}
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    onClick={() => setIssuesOnly(v => !v)}
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {issuesOnly ? 'Showing issues only' : 'Show issues only'}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {loading
              ? (
                <div className="p-6 space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              )
              : (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10" />
                      <TableHead>Student</TableHead>
                      <TableHead>DOB</TableHead>
                      <TableHead className="hidden md:table-cell">ID</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="hidden lg:table-cell">BE/ESL</TableHead>
                      <TableHead className="hidden xl:table-cell">Activity</TableHead>
                      <TableHead className="hidden lg:table-cell">Session</TableHead>
                      <TableHead>Time In (EPE)</TableHead>
                      <TableHead>Time Out (EPE)</TableHead>
                      <TableHead>Total Time (EPE)</TableHead>
                      <TableHead>Registered By</TableHead>
                      <TableHead>Date &amp; Time</TableHead>
                      <TableHead className="hidden sm:table-cell">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedEnrollments.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={tableColSpan + 1} className="text-center py-12 text-muted-foreground">
                          {issuesOnly
                            ? 'No intake issues on this page. Try a wider period or search.'
                            : 'No intake activity in this period. Returning visits on older files now count — try Refresh, or use All Time.'}
                        </TableCell>
                      </TableRow>
                    )}
                    {displayedEnrollments.map(e => {
                      const visits = getVisitHistory(e);
                      const latest = resolveLatestIntakeDisplay(e);
                      const visitValidation = validateEnrollmentVisits(
                        e,
                        schoolSessionMap,
                        defaultIntakeSessions,
                      );
                      const hasHistory = visits.length > 0;
                      const isExpanded = expandedId === e._id;
                      return (
                      <>
                      <TableRow
                        key={e._id}
                        className={visitValidation.hasIssues
                          ? 'bg-amber-50/50 dark:bg-amber-950/10 hover:bg-amber-50/80 dark:hover:bg-amber-950/20'
                          : 'hover:bg-muted/30'}
                      >
                        <TableCell className="w-10 p-2">
                          {hasHistory ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              aria-expanded={isExpanded}
                              aria-label={isExpanded ? 'Hide visit history' : 'Show visit history'}
                              onClick={() => setExpandedId(isExpanded ? null : e._id)}
                            >
                              {isExpanded
                                ? <ChevronUp className="h-4 w-4" />
                                : <ChevronDown className="h-4 w-4" />}
                            </Button>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">
                              {(e.firstName?.[0] ?? '?').toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium whitespace-nowrap">{formatFullName(e)}</p>
                              {e.school && <p className="text-xs text-muted-foreground">{e.school}</p>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">{e.dob}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className="font-mono text-xs text-muted-foreground">
                            {e.labelId || e.studentId || '—'}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {(e.intakeStudentStatus || e.program)
                            ? <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">{e.intakeStudentStatus || e.program}</Badge>
                            : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs">
                          {latest.educationStatus
                            ? <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">{latest.educationStatus}</Badge>
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="hidden xl:table-cell text-xs text-muted-foreground max-w-[180px]">
                          {latest.intakeActivity?.length ? latest.intakeActivity.join(', ') : '—'}
                          {latest.placementClass ? <span className="block text-[10px] italic">Class: {latest.placementClass}</span> : null}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground whitespace-nowrap">
                          {latest.intakeSession || '—'}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap" title={epeTimeTitle(latest.timeIn)}>
                          {fmtEpeTimeStr(latest.timeIn)}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {latest.isLeaving === 'Staying'
                            ? <span className="text-muted-foreground italic">Staying</span>
                            : (
                              <span title={epeTimeTitle(latest.timeOut)}>
                                {fmtEpeTimeStr(latest.timeOut)}
                              </span>
                            )}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap font-medium">
                          {e.durationMinutes != null
                            ? <span className="text-primary">{fmtDuration(e.durationMinutes)}</span>
                            : <span className="text-muted-foreground">—</span>}
                          {visitValidation.hasIssues && (
                            <div className="mt-1 flex flex-col items-start gap-1">
                              <span
                                className={
                                  visitValidation.flags.some(f =>
                                    f.type === 'missing_final_clock_out' || f.type === 'overlapping_times',
                                  )
                                    ? 'ui-badge-danger text-[10px]'
                                    : 'ui-badge-warning text-[10px]'
                                }
                                title={visitValidation.flags.map(f => f.message).join('\n')}
                              >
                                <AlertTriangle className="h-2.5 w-2.5" />
                                {primaryIntakeIssueLabel(visitValidation.flags)}
                              </span>
                              {canFix && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-6 text-[10px] px-2 gap-1"
                                  onClick={() => setFixTarget({
                                    id: e._id,
                                    name: formatFullName(e),
                                  })}
                                >
                                  <Wrench className="h-3 w-3" />
                                  Fix
                                </Button>
                              )}
                            </div>
                          )}
                          {hasHistory && (
                            <button
                              type="button"
                              onClick={() => setExpandedId(isExpanded ? null : e._id)}
                              className="block text-[10px] text-primary hover:underline font-normal text-left"
                            >
                              {visits.length} visit{visits.length !== 1 ? 's' : ''} — view history
                            </button>
                          )}
                        </TableCell>
                        <TableCell>
                          {e.createdBy ? (
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-foreground text-[10px] font-bold shrink-0 border border-border">
                                {initials(e.createdBy.name || e.createdBy.email)}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-medium truncate max-w-[120px]">{e.createdBy.name}</p>
                                <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">{e.createdBy.email}</p>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="whitespace-nowrap">
                            <p className="text-xs font-medium">{fmtDate(e.createdAt)}</p>
                            <p className="text-[10px] text-muted-foreground">{fmtTime(e.createdAt)}</p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div className="flex items-center gap-1 flex-wrap">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">
                              {e.status || 'Active'}
                            </Badge>
                            {e.siblingFlag && (
                              <span className="ui-badge-warning text-[10px]">
                                <AlertTriangle className="h-2.5 w-2.5" /> Flagged
                              </span>
                            )}
                            {e.siblingConfirmed && (
                              <span className="ui-badge-info text-[10px]">
                                <Link2 className="h-2.5 w-2.5" /> Sibling
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && hasHistory && (
                        <TableRow key={`${e._id}-visits`} className="bg-muted/20 hover:bg-muted/20">
                          <TableCell colSpan={tableColSpan + 1} className="py-4 px-6">
                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-medium flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-primary" />
                                  Intake visit history — {formatFullName(e)}
                                </p>
                                <Badge variant="outline" className="text-xs">
                                  Total: {fmtTotalHM(epeVisitsTotalMinutes(visits) ?? 0)}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Latest row in the table above reflects the most recent visit. Visits are listed oldest to newest.
                                Same-day staff handoffs should be marked Staying. If the student leaves and returns later that day,
                                mark Leaving with Time Out, then log a new visit — each completed cycle is counted separately for EPE.
                                Missing Time-Out is flagged after the session or day ends. Use Fix to set an end time, dismiss an earlier
                                visit for re-admit, or add a catch-up activity on a later date.
                              </p>
                              <IntakeVisitHistory visits={visits} validation={visitValidation} />
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                      </>
                    );
                    })}
                  </TableBody>
                </Table>
                </div>
              )
            }

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <p className="text-xs text-muted-foreground">
                  Showing {((pagination.page - 1) * pagination.limit) + 1}–
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total.toLocaleString()}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline" size="sm"
                    disabled={pagination.page <= 1 || loading}
                    onClick={() => setPage(p => p - 1)}
                    className="h-7 w-7 p-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs px-2">{pagination.page} / {pagination.pages}</span>
                  <Button
                    variant="outline" size="sm"
                    disabled={pagination.page >= pagination.pages || loading}
                    onClick={() => setPage(p => p + 1)}
                    className="h-7 w-7 p-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

      {fixTarget && (
        <IntakeHandoffFixDialog
          studentId={fixTarget.id}
          studentName={fixTarget.name}
          open={Boolean(fixTarget)}
          onOpenChange={open => { if (!open) setFixTarget(null); }}
          onFixed={handleFixed}
        />
      )}
    </div>
  );
}
