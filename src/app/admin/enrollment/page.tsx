'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import AdminHeader from '@/components/AdminHeader';
import {
  UserPlus, Users, CalendarDays, Clock, TrendingUp,
  RefreshCw, Loader2, Search, Filter, ChevronLeft, ChevronRight,
  Medal, Award, Star, AlertTriangle, Link2,
  ArrowLeft,
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
interface TrendPoint { date: string; count: number; }
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
  intakeVisits?: { date?: string; timeIn?: string; timeOut?: string; isLeaving?: string }[];
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
function fmtDateShort(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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

// ── Mini bar chart ────────────────────────────────────────────────────────────
function TrendBar({ trend }: { trend: TrendPoint[] }) {
  if (!trend.length) return <p className="text-xs text-muted-foreground italic">No trend data yet.</p>;
  const max = Math.max(...trend.map(t => t.count), 1);
  return (
    <div className="flex items-end gap-1 h-16">
      {trend.map(t => (
        <div key={t.date} className="flex flex-col items-center gap-0.5 flex-1 group relative">
          <div
            className="w-full rounded-t-sm bg-primary/70 hover:bg-primary transition-colors"
            style={{ height: `${Math.max(4, (t.count / max) * 56)}px` }}
          />
          <span className="text-[9px] text-muted-foreground hidden group-hover:block absolute bottom-full mb-1 bg-popover border rounded px-1.5 py-0.5 whitespace-nowrap shadow-sm z-10">
            {fmtDateShort(t.date)}: {t.count}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function EnrollmentPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();

  const [period, setPeriod] = useState('month');
  const [staffFilter, setStaffFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [intakeTime, setIntakeTime] = useState<IntakeTime | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);

  const role = (session?.user as any)?.role ?? '';

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.replace('/admin');
    if (authStatus === 'authenticated' && !['Admin', 'Data Lead'].includes(role)) {
      router.replace('/admin');
    }
  }, [authStatus, role, router]);

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
      setStaff(data.staffBreakdown || []);
      setTrend(data.trend || []);
      setEnrollments(data.enrollments || []);
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
  useEffect(() => { setPage(1); }, [period, staffFilter, search]);

  if (authStatus === 'loading') return null;

  const METRIC_CARDS = metrics ? [
    { label: 'Today', value: metrics.today, icon: <Clock className="h-5 w-5 text-blue-500" />, color: 'text-blue-600' },
    { label: 'This Week', value: metrics.week, icon: <CalendarDays className="h-5 w-5 text-violet-500" />, color: 'text-violet-600' },
    { label: 'This Month', value: metrics.month, icon: <TrendingUp className="h-5 w-5 text-emerald-500" />, color: 'text-emerald-600' },
    { label: 'All Time', value: metrics.all, icon: <Users className="h-5 w-5 text-orange-500" />, color: 'text-orange-600' },
  ] : [];

  const maxStaffCount = Math.max(...staff.map(s => s.count), 1);

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <main className="w-full px-4 sm:px-6 py-6 space-y-6">

        {/* Back button */}
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Button>

        {/* Page header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <UserPlus className="h-6 w-6 text-primary" />
              Enrollment Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track student registrations by staff member, time period, and school.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* ── Metric cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {loading && !metrics
            ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}><CardContent className="pt-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
            ))
            : METRIC_CARDS.map(m => (
              <Card key={m.label} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{m.label}</p>
                      <p className={`text-3xl font-bold mt-1 ${m.color}`}>{m.value.toLocaleString()}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/50">{m.icon}</div>
                  </div>
                </CardContent>
              </Card>
            ))
          }
        </div>

        {/* ── Intake time summary ── */}
        {intakeTime && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="pt-5 pb-4 flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Intake Time</p>
                  <p className="text-3xl font-bold mt-1 text-primary">{fmtTotalHM(intakeTime.totalMinutes)}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{intakeTime.totalMinutes.toLocaleString()} minutes total</p>
                </div>
                <div className="p-2 rounded-lg bg-muted/50"><Clock className="h-5 w-5 text-primary" /></div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-4 flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Avg per Student</p>
                  <p className="text-3xl font-bold mt-1">{fmtTotalHM(intakeTime.avgMinutes)}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{intakeTime.avgMinutes} min · across all visits</p>
                </div>
                <div className="p-2 rounded-lg bg-muted/50"><TrendingUp className="h-5 w-5 text-emerald-500" /></div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-4 flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Visits</p>
                  <p className="text-3xl font-bold mt-1">{intakeTime.visits.toLocaleString()}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{intakeTime.sessions.toLocaleString()} students with time logged</p>
                </div>
                <div className="p-2 rounded-lg bg-muted/50"><CalendarDays className="h-5 w-5 text-violet-500" /></div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Staff leaderboard ── */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> Staff Registrations
              </CardTitle>
              <CardDescription>Grouped by period filter</CardDescription>
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
                        {/* Rank badge */}
                        <div className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold shrink-0 ${
                          i < 3 ? RANK_COLORS[i] : 'bg-muted text-muted-foreground border-border'
                        }`}>
                          {i < 3 ? RANK_ICONS[i] : i + 1}
                        </div>
                        {/* Name + bar */}
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
                <TrendingUp className="h-4 w-4 text-primary" /> Daily Enrollment Trend
              </CardTitle>
              <CardDescription>Registrations per day — hover a bar for the count</CardDescription>
            </CardHeader>
            <CardContent>
              {loading && trend.length === 0
                ? <Skeleton className="h-16 w-full" />
                : <TrendBar trend={trend} />
              }
              {!loading && trend.length > 0 && (
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1 px-0.5">
                  <span>{fmtDateShort(trend[0].date)}</span>
                  <span>{fmtDateShort(trend[trend.length - 1].date)}</span>
                </div>
              )}
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

                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search student or staff…"
                    className="pl-8 h-8 text-xs w-52"
                  />
                </div>
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
                      <TableHead>Student</TableHead>
                      <TableHead>DOB</TableHead>
                      <TableHead className="hidden md:table-cell">ID</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="hidden lg:table-cell">BE/ESL</TableHead>
                      <TableHead className="hidden xl:table-cell">Activity</TableHead>
                      <TableHead className="hidden lg:table-cell">Session</TableHead>
                      <TableHead>Time In</TableHead>
                      <TableHead>Time Out</TableHead>
                      <TableHead>Total Time</TableHead>
                      <TableHead>Registered By</TableHead>
                      <TableHead>Date &amp; Time</TableHead>
                      <TableHead className="hidden sm:table-cell">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {enrollments.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={13} className="text-center py-12 text-muted-foreground">
                          No enrollments match the current filters.
                        </TableCell>
                      </TableRow>
                    )}
                    {enrollments.map(e => (
                      <TableRow key={e._id} className="hover:bg-muted/30">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">
                              {(e.firstName?.[0] ?? '?').toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium whitespace-nowrap">{e.firstName} {e.lastName}</p>
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
                          {e.educationStatus
                            ? <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">{e.educationStatus}</Badge>
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="hidden xl:table-cell text-xs text-muted-foreground max-w-[180px]">
                          {e.intakeActivity?.length ? e.intakeActivity.join(', ') : '—'}
                          {e.placementClass ? <span className="block text-[10px] italic">Class: {e.placementClass}</span> : null}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground whitespace-nowrap">
                          {e.intakeSession || '—'}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{fmtTimeStr(e.timeIn)}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {e.isLeaving === 'Staying'
                            ? <span className="text-muted-foreground italic">Staying</span>
                            : fmtTimeStr(e.timeOut)}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap font-medium">
                          {e.durationMinutes != null
                            ? <span className="text-primary">{fmtDuration(e.durationMinutes)}</span>
                            : <span className="text-muted-foreground">—</span>}
                          {(e.visitCount ?? 0) > 1 && (
                            <span className="block text-[10px] text-muted-foreground font-normal">
                              {e.visitCount} visits
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {e.createdBy ? (
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 text-violet-700 text-[10px] font-bold shrink-0 border border-violet-200">
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
                              <Badge className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-100">
                                <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> Flagged
                              </Badge>
                            )}
                            {e.siblingConfirmed && (
                              <Badge className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-100">
                                <Link2 className="h-2.5 w-2.5 mr-0.5" /> Sibling
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
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

      </main>
    </div>
  );
}
