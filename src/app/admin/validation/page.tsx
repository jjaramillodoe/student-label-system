'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import AdminHeader from '@/components/AdminHeader';
import {
  Mail, ShieldCheck, RefreshCw, Loader2, Search, CheckCircle2,
  XCircle, HelpCircle, Clock, AlertTriangle, ChevronLeft,
  ChevronRight, Play, Download, CheckCheck, Zap,
  ArrowLeft,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Usage { used: number; quota: number; remaining: number; month: string; }
interface ValidationJob {
  _id: string;
  validationId: string | null;
  studentDbId: string;
  email: string;
  firstName: string;
  lastName: string;
  school?: string;
  labelId?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETE' | 'FAILED';
  emailStatus: 'UNKNOWN' | 'VALID' | 'INVALID';
  submittedAt: string;
  completedAt: string | null;
  appliedAt: string | null;
  submittedBy?: { name: string; email: string };
}
interface Student {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  school?: string;
  labelId?: string;
  studentId?: string;
  emailValidationStatus?: string;
  emailValidatedAt?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtTime(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function EmailStatusBadge({ status }: { status: string }) {
  if (status === 'VALID')
    return <Badge className="gap-1 bg-green-100 text-green-700 border-green-300 hover:bg-green-100"><CheckCircle2 className="h-3 w-3" />Valid</Badge>;
  if (status === 'INVALID')
    return <Badge className="gap-1 bg-red-100 text-red-700 border-red-300 hover:bg-red-100"><XCircle className="h-3 w-3" />Invalid</Badge>;
  if (status === 'CATCH_ALL')
    return <Badge className="gap-1 bg-yellow-100 text-yellow-700 border-yellow-300 hover:bg-yellow-100"><HelpCircle className="h-3 w-3" />Catch-all</Badge>;
  if (status === 'PENDING')
    return <Badge className="gap-1 bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-100"><Clock className="h-3 w-3" />Pending</Badge>;
  return <Badge className="gap-1 bg-muted text-muted-foreground border-border hover:bg-muted"><HelpCircle className="h-3 w-3" />Unknown</Badge>;
}

function JobStatusBadge({ status }: { status: string }) {
  if (status === 'COMPLETE')
    return <Badge className="gap-1 bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-100 text-[10px]"><CheckCheck className="h-2.5 w-2.5" />Complete</Badge>;
  if (status === 'PENDING')
    return <Badge className="gap-1 bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-100 text-[10px]"><Clock className="h-2.5 w-2.5" />Pending</Badge>;
  if (status === 'FAILED')
    return <Badge className="gap-1 bg-red-100 text-red-700 border-red-300 hover:bg-red-100 text-[10px]"><XCircle className="h-2.5 w-2.5" />Failed</Badge>;
  return <Badge className="gap-1 bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-100 text-[10px]"><Loader2 className="h-2.5 w-2.5 animate-spin" />In Progress</Badge>;
}

// ── Usage Meter ───────────────────────────────────────────────────────────────
function UsageMeter({ usage }: { usage: Usage }) {
  const pct = Math.round((usage.used / usage.quota) * 100);
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Monthly Usage</p>
            <p className="text-2xl font-bold">
              {usage.used.toLocaleString()}
              <span className="text-base font-normal text-muted-foreground"> / {usage.quota.toLocaleString()}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{usage.month}</p>
            <p className={`text-lg font-bold ${pct >= 90 ? 'text-red-600' : pct >= 70 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {usage.remaining.toLocaleString()} left
            </p>
          </div>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
        <p className="text-xs text-muted-foreground mt-1">{pct}% of monthly quota used</p>
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ValidationPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const role = (session?.user as any)?.role ?? '';

  // Jobs tab state
  const [usage, setUsage] = useState<Usage | null>(null);
  const [jobs, setJobs] = useState<ValidationJob[]>([]);
  const [jobsTotal, setJobsTotal] = useState(0);
  const [jobsPage, setJobsPage] = useState(1);
  const [jobsPages, setJobsPages] = useState(1);
  const [jobStatusFilter, setJobStatusFilter] = useState('');
  const [loadingJobs, setLoadingJobs] = useState(true);

  // Students tab state
  const [students, setStudents] = useState<Student[]>([]);
  const [studentsTotal, setStudentsTotal] = useState(0);
  const [studentsPage, setStudentsPage] = useState(1);
  const [studentsPages, setStudentsPages] = useState(1);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentFilter, setStudentFilter] = useState('has_email'); // has_email | all | no_email
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [excludedCount, setExcludedCount] = useState(0);

  // Actions state
  const [syncing, setSyncing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [applying, setApplying] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Auto-poll state
  const [autoPolling, setAutoPolling] = useState(false);
  const [pollCountdown, setPollCountdown] = useState(0);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [activeTab, setActiveTab] = useState('jobs');

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.replace('/admin');
    if (authStatus === 'authenticated' && !['Admin', 'Data Lead'].includes(role)) router.replace('/admin');
  }, [authStatus, role, router]);

  // ── Load jobs ──────────────────────────────────────────────────────────────
  const loadJobs = useCallback(async () => {
    setLoadingJobs(true);
    try {
      const params = new URLSearchParams({ page: String(jobsPage) });
      if (jobStatusFilter) params.set('status', jobStatusFilter);
      const res = await fetch(`/api/admin/email-validation?${params}`);
      const data = await res.json();
      setUsage(data.usage);
      setJobs(data.jobs ?? []);
      setJobsTotal(data.pagination?.total ?? 0);
      setJobsPages(data.pagination?.pages ?? 1);
    } finally {
      setLoadingJobs(false);
    }
  }, [jobsPage, jobStatusFilter]);

  // ── Load students ──────────────────────────────────────────────────────────
  const loadStudents = useCallback(async () => {
    setLoadingStudents(true);
    try {
      const params = new URLSearchParams({
        page: String(studentsPage),
        emailFilter: studentFilter,
      });
      if (studentSearch) params.set('q', studentSearch);
      const res = await fetch(`/api/students/email-list?${params}`);
      const data = await res.json();
      setStudents(data.students ?? []);
      setStudentsTotal(data.total ?? 0);
      setStudentsPages(data.pages ?? 1);
      setExcludedCount(data.excluded ?? 0);
    } finally {
      setLoadingStudents(false);
    }
  }, [studentsPage, studentFilter, studentSearch]);

  useEffect(() => { if (authStatus === 'authenticated') loadJobs(); }, [authStatus, loadJobs]);
  useEffect(() => { if (authStatus === 'authenticated' && activeTab === 'submit') loadStudents(); }, [authStatus, activeTab, loadStudents]);
  useEffect(() => { setStudentsPage(1); setSelected(new Set()); }, [studentSearch, studentFilter]);

  // ── Auto-poll: when there are IN_PROGRESS jobs, sync every 8 seconds ───────
  const silentSync = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/email-validation/sync', { method: 'POST' });
      const data = await res.json();
      if (data.updated > 0) flash('success', `Auto-sync: ${data.updated} result(s) updated.`);
      await loadJobs();
    } catch { /* silent */ }
  }, [loadJobs]);

  const POLL_INTERVAL = 8; // seconds

  function startCountdown(onComplete: () => void) {
    setPollCountdown(POLL_INTERVAL);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setPollCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    pollTimerRef.current = setTimeout(onComplete, POLL_INTERVAL * 1000);
  }

  // Watch for PENDING or IN_PROGRESS jobs and manage polling lifecycle
  useEffect(() => {
    const hasActive = jobs.some(j => j.status === 'PENDING' || j.status === 'IN_PROGRESS');
    if (hasActive && !autoPolling) {
      setAutoPolling(true);
    }
    if (!hasActive && autoPolling) {
      setAutoPolling(false);
      setPollCountdown(0);
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    }
  }, [jobs, autoPolling]);

  useEffect(() => {
    if (!autoPolling) return;
    let cancelled = false;

    const runPoll = async () => {
      if (cancelled) return;
      await silentSync();
      if (!cancelled) startCountdown(runPoll);
    };

    // Run immediately on first activation, then every POLL_INTERVAL seconds
    runPoll();

    return () => {
      cancelled = true;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPolling]);

  function flash(type: 'success' | 'error', text: string) {
    setActionMsg({ type, text });
    setTimeout(() => setActionMsg(null), 5000);
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch('/api/admin/email-validation/sync', { method: 'POST' });
      const data = await res.json();
      flash('success', `Synced: ${data.updated} job(s) updated.`);
      await loadJobs();
    } catch {
      flash('error', 'Sync failed.');
    } finally {
      setSyncing(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/admin/email-validation/test');
      const data = await res.json();
      setTestResult(data);
    } catch (e) {
      setTestResult({ error: String(e) });
    } finally {
      setTesting(false);
    }
  }

  async function handleApply() {
    setApplying(true);
    try {
      const res = await fetch('/api/admin/email-validation/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const data = await res.json();
      flash('success', `Applied ${data.applied} result(s) to student records.`);
      await loadJobs();
    } catch {
      flash('error', 'Apply failed.');
    } finally {
      setApplying(false);
    }
  }

  async function handleSubmit() {
    if (selected.size === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/email-validation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentIds: Array.from(selected) }),
      });
      const data = await res.json();
      if (!res.ok) { flash('error', data.error ?? 'Submission failed.'); return; }
      flash('success', `Submitted ${data.submitted} email(s) for validation. ${data.skipped?.length ? `${data.skipped.length} skipped (no valid email).` : ''}`);
      setSelected(new Set());
      setActiveTab('jobs');
      await loadJobs();
    } catch {
      flash('error', 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  }

  function toggleStudent(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleAll() {
    const eligibleIds = students.filter(s => s.email).map(s => s._id);
    const allSelected = eligibleIds.every(id => selected.has(id));
    setSelected(allSelected ? new Set() : new Set(eligibleIds));
  }

  const pendingApply = jobs.filter(j => j.status === 'COMPLETE' && !j.appliedAt).length;
  const inProgress  = jobs.filter(j => j.status === 'IN_PROGRESS' || j.status === 'PENDING').length;

  if (authStatus === 'loading') return null;

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
              <ShieldCheck className="h-6 w-6 text-primary" />
              Email Validation
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Validate student emails via EmailAwesome · {usage?.quota.toLocaleString() ?? '1,000'}/month limit
            </p>
          </div>
        </div>

        {actionMsg && (
          <Alert variant={actionMsg.type === 'error' ? 'destructive' : 'default'}
            className={actionMsg.type === 'success' ? 'border-green-400 bg-green-50 text-green-800' : ''}>
            <AlertDescription>{actionMsg.text}</AlertDescription>
          </Alert>
        )}

        {/* Usage meter */}
        {usage ? <UsageMeter usage={usage} /> : <Skeleton className="h-24 w-full" />}

        {/* Action bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing || loadingJobs} className="gap-2">
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sync Status
          </Button>

          <Button variant="outline" size="sm" onClick={handleTest} disabled={testing} className="gap-2 border-violet-300 text-violet-700 hover:bg-violet-50">
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            Test API Connection
          </Button>

          {pendingApply > 0 && (
            <Button size="sm" onClick={handleApply} disabled={applying} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
              {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Apply {pendingApply} Result{pendingApply !== 1 ? 's' : ''} to Students
            </Button>
          )}

          {inProgress > 0 && (
            <div className="flex items-center gap-2">
              <Badge className="gap-1 bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-100">
                <Loader2 className="h-3 w-3 animate-spin" />
                {inProgress} checking…
              </Badge>
              {pollCountdown > 0 && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  next sync in {pollCountdown}s
                </span>
              )}
            </div>
          )}
        </div>

        {/* API test result */}
        {testResult && (
          <Card className="border-violet-200 bg-violet-50 dark:bg-violet-950/20">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm flex items-center gap-2 text-violet-700">
                <Zap className="h-4 w-4" /> API Diagnostic Result
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pb-4">
              {/* Key status */}
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground w-32 shrink-0">API Key:</span>
                {testResult.apiKeyPresent
                  ? <Badge className="bg-green-100 text-green-700 border-green-300 gap-1"><CheckCircle2 className="h-3 w-3" /> Loaded — {testResult.apiKeyPreview}</Badge>
                  : <Badge className="bg-red-100 text-red-700 border-red-300 gap-1"><XCircle className="h-3 w-3" /> MISSING — check .env</Badge>
                }
              </div>

              {/* GET result */}
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  GET (list validations) — HTTP {testResult.get?.status}
                </p>
                <pre className="text-xs bg-background border rounded p-3 overflow-x-auto whitespace-pre-wrap max-h-36">
                  {JSON.stringify(testResult.get?.body, null, 2)}
                </pre>
              </div>

              {/* POST result */}
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  POST (submit test email) — HTTP {testResult.post?.status}
                </p>
                <pre className="text-xs bg-background border rounded p-3 overflow-x-auto whitespace-pre-wrap max-h-36">
                  {JSON.stringify(testResult.post?.body, null, 2)}
                </pre>
              </div>

              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setTestResult(null)}>
                Dismiss
              </Button>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="jobs" className="gap-1.5">
              <Mail className="h-3.5 w-3.5" /> Validation Jobs
              {jobsTotal > 0 && <Badge variant="secondary" className="ml-1 text-xs h-4 px-1">{jobsTotal}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="submit" className="gap-1.5">
              <Play className="h-3.5 w-3.5" /> Submit New
              {selected.size > 0 && <Badge className="ml-1 text-xs h-4 px-1 bg-primary text-primary-foreground">{selected.size}</Badge>}
            </TabsTrigger>
          </TabsList>

          {/* ── Jobs tab ─────────────────────────────────────────────────── */}
          <TabsContent value="jobs" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <CardTitle className="text-base">Validation History</CardTitle>
                    <CardDescription>{jobsTotal} total validation jobs</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={jobStatusFilter || 'all'} onValueChange={v => setJobStatusFilter(v === 'all' ? '' : v)}>
                      <SelectTrigger className="w-36 h-8 text-xs">
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                        <SelectItem value="COMPLETE">Complete</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="sm" onClick={loadJobs} disabled={loadingJobs} className="h-8 w-8 p-0">
                      <RefreshCw className={`h-4 w-4 ${loadingJobs ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loadingJobs
                  ? <div className="p-6 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
                  : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Email Status</TableHead>
                          <TableHead>Job Status</TableHead>
                          <TableHead className="hidden sm:table-cell">Submitted</TableHead>
                          <TableHead className="hidden md:table-cell">By</TableHead>
                          <TableHead className="hidden sm:table-cell">Applied</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {jobs.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                              No validation jobs yet. Go to "Submit New" to validate student emails.
                            </TableCell>
                          </TableRow>
                        )}
                        {jobs.map(j => (
                          <TableRow key={j._id}>
                            <TableCell>
                              <div className="font-medium text-sm">{j.firstName} {j.lastName}</div>
                              {j.labelId && <div className="font-mono text-[10px] text-muted-foreground">{j.labelId}</div>}
                            </TableCell>
                            <TableCell className="font-mono text-xs">{j.email}</TableCell>
                            <TableCell><EmailStatusBadge status={j.emailStatus} /></TableCell>
                            <TableCell><JobStatusBadge status={j.status} /></TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <div className="text-xs">{fmtDate(j.submittedAt)}</div>
                              <div className="text-[10px] text-muted-foreground">{fmtTime(j.submittedAt)}</div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                              {j.submittedBy?.name ?? '—'}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              {j.appliedAt
                                ? <Badge className="text-[10px] bg-green-50 text-green-700 border-green-200 hover:bg-green-50 gap-1"><CheckCircle2 className="h-2.5 w-2.5" />{fmtDate(j.appliedAt)}</Badge>
                                : <span className="text-xs text-muted-foreground">—</span>
                              }
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )
                }

                {jobsPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <p className="text-xs text-muted-foreground">Page {jobsPage} of {jobsPages}</p>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" disabled={jobsPage <= 1} onClick={() => setJobsPage(p => p - 1)} className="h-7 w-7 p-0">
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" disabled={jobsPage >= jobsPages} onClick={() => setJobsPage(p => p + 1)} className="h-7 w-7 p-0">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Submit new tab ───────────────────────────────────────────── */}
          <TabsContent value="submit" className="mt-4 space-y-4">

            {usage && usage.remaining <= 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>Monthly quota reached ({usage.quota} validations). Resets next month.</AlertDescription>
              </Alert>
            )}

            {usage && usage.remaining > 0 && selected.size > usage.remaining && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  You selected {selected.size} but only {usage.remaining} validations remain this month.
                  Please deselect {selected.size - usage.remaining} student(s).
                </AlertDescription>
              </Alert>
            )}

            {/* Filters + submit */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input value={studentSearch} onChange={e => setStudentSearch(e.target.value)}
                    placeholder="Search students…" className="pl-8 h-8 text-xs w-52" />
                </div>
                <Select value={studentFilter} onValueChange={setStudentFilter}>
                  <SelectTrigger className="w-44 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="has_email">Has email</SelectItem>
                    <SelectItem value="not_validated">Not yet validated</SelectItem>
                    <SelectItem value="invalid">Previously invalid</SelectItem>
                    <SelectItem value="all">All students</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">{studentsTotal} students</span>
                {excludedCount > 0 && (
                  <Badge variant="outline" className="text-xs gap-1 text-amber-700 border-amber-300 bg-amber-50">
                    <Clock className="h-3 w-3" />
                    {excludedCount} already queued or processing — hidden
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2">
                {selected.size > 0 && (
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => setSelected(new Set())}>
                    Clear ({selected.size})
                  </Button>
                )}
                <Button
                  size="sm"
                  disabled={selected.size === 0 || submitting || !usage || usage.remaining <= 0 || selected.size > usage.remaining}
                  onClick={handleSubmit}
                  className="gap-2 bg-primary"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  Validate {selected.size > 0 ? selected.size : ''} Email{selected.size !== 1 ? 's' : ''}
                </Button>
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                {loadingStudents
                  ? <div className="p-6 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
                  : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">
                            <Checkbox
                              checked={students.filter(s => s.email).length > 0 && students.filter(s => s.email).every(s => selected.has(s._id))}
                              onCheckedChange={toggleAll}
                            />
                          </TableHead>
                          <TableHead>Student</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead className="hidden sm:table-cell">School</TableHead>
                          <TableHead>Validation</TableHead>
                          <TableHead className="hidden md:table-cell">Validated</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {students.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                              No students match the current filters.
                            </TableCell>
                          </TableRow>
                        )}
                        {students.map(s => (
                          <TableRow
                            key={s._id}
                            className={`cursor-pointer ${selected.has(s._id) ? 'bg-primary/5' : 'hover:bg-muted/30'} ${!s.email ? 'opacity-50' : ''}`}
                            onClick={() => s.email && toggleStudent(s._id)}
                          >
                            <TableCell onClick={e => e.stopPropagation()}>
                              <Checkbox
                                checked={selected.has(s._id)}
                                disabled={!s.email}
                                onCheckedChange={() => s.email && toggleStudent(s._id)}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-sm">{s.firstName} {s.lastName}</div>
                              <div className="font-mono text-[10px] text-muted-foreground">{s.labelId || s.studentId}</div>
                            </TableCell>
                            <TableCell>
                              {s.email
                                ? <span className="font-mono text-xs">{s.email}</span>
                                : <span className="text-xs text-muted-foreground italic">No email</span>
                              }
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{s.school ?? '—'}</TableCell>
                            <TableCell>
                              {s.emailValidationStatus
                                ? <EmailStatusBadge status={s.emailValidationStatus} />
                                : <span className="text-xs text-muted-foreground">—</span>
                              }
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                              {fmtDate(s.emailValidatedAt ?? null)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )
                }

                {studentsPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <p className="text-xs text-muted-foreground">Page {studentsPage} of {studentsPages}</p>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" disabled={studentsPage <= 1} onClick={() => setStudentsPage(p => p - 1)} className="h-7 w-7 p-0">
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" disabled={studentsPage >= studentsPages} onClick={() => setStudentsPage(p => p + 1)} className="h-7 w-7 p-0">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

      </main>
    </div>
  );
}
