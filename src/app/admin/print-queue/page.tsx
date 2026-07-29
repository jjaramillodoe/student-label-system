'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import AdminHeader from '@/components/AdminHeader';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Package,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  XCircle,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const LABEL_TEMPLATES: Record<string, { name: string; labelsPerSheet: number }> = {
  avery5160: { name: 'Avery 5160 (3x10 Sheet)', labelsPerSheet: 30 },
  avery5163: { name: 'Avery 5163 (2x5 Sheet)', labelsPerSheet: 10 },
  avery94205: { name: 'Avery 94205 (2x5 — 1.5"×3.75")', labelsPerSheet: 10 },
  brother1201: { name: 'Brother DK-1201 (1.1" x 3.5")', labelsPerSheet: 1 },
  brother11208: { name: 'Brother DK-11208 (1.1" x 2.1")', labelsPerSheet: 1 },
  brother2205: { name: 'Brother DK-2205 (2.1" x 2.1")', labelsPerSheet: 1 },
  brother22208: { name: 'Brother DK-22208 (2.1" x 2.8")', labelsPerSheet: 1 },
};

interface PrintJob {
  _id: string;
  time: string;
  students?: Array<{
    studentId?: string;
    firstName?: string;
    lastName?: string;
  }>;
  labelCount?: number;
  layout?: string;
  status?: string;
  jobStatus?: string;
  error?: string;
  user?: {
    name?: string;
    email?: string;
    role?: string;
    school?: string;
  } | null;
}

interface LabelStock {
  _id: string;
  template: string;
  currentStock: number;
  lowStockThreshold?: number;
  supplier?: string;
}

function getTemplateName(layout?: string) {
  if (!layout) return 'Unknown';
  return LABEL_TEMPLATES[layout]?.name || layout;
}

function getLabelsPerSheet(layout?: string) {
  if (!layout) return 1;
  return LABEL_TEMPLATES[layout]?.labelsPerSheet || 1;
}

function getJobStatus(job: PrintJob) {
  const status = (job.status || job.jobStatus || '').toLowerCase();
  if (status.includes('fail') || job.error) return 'failed';
  if (status.includes('queue') || status.includes('pending')) return 'queued';
  return 'completed';
}

function getStudentCount(job: PrintJob) {
  return job.labelCount || job.students?.length || 0;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function PrintQueuePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [stock, setStock] = useState<LabelStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [layoutFilter, setLayoutFilter] = useState('all');
  const [reprintJob, setReprintJob] = useState<PrintJob | null>(null);

  useEffect(() => {
    if (status === 'loading') return;

    if (!session) {
      router.push('/auth/signin');
      return;
    }

    if (!['Admin', 'Data Lead'].includes(session.user.role || '')) {
      router.push('/');
      return;
    }

    fetchData();
  }, [session, status, router]);

  async function fetchData() {
    setLoading(true);
    setError('');

    try {
      const [historyRes, stockRes] = await Promise.all([
        fetch('/api/print-history?limit=500'),
        fetch('/api/label-stock'),
      ]);

      if (!historyRes.ok) throw new Error('Failed to fetch print history');

      const historyData = await historyRes.json();
      const stockData = stockRes.ok ? await stockRes.json() : [];

      setJobs(Array.isArray(historyData) ? historyData : []);
      setStock(Array.isArray(stockData) ? stockData : []);
    } catch (err) {
      setError('Failed to load print queue and history.');
    } finally {
      setLoading(false);
    }
  }

  const layoutOptions = useMemo(() => {
    return Array.from(new Set(jobs.map(job => job.layout).filter(Boolean))).sort() as string[];
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    const normalizedSearch = search.toLowerCase();

    return jobs.filter(job => {
      const jobStatus = getJobStatus(job);
      const matchesStatus = statusFilter === 'all' || jobStatus === statusFilter;
      const matchesLayout = layoutFilter === 'all' || job.layout === layoutFilter;
      const matchesSearch = !normalizedSearch || (
        (job.user?.name || '').toLowerCase().includes(normalizedSearch) ||
        (job.user?.email || '').toLowerCase().includes(normalizedSearch) ||
        (job.user?.school || '').toLowerCase().includes(normalizedSearch) ||
        (job.students || []).some(student =>
          `${student.firstName || ''} ${student.lastName || ''} ${student.studentId || ''}`
            .toLowerCase()
            .includes(normalizedSearch)
        )
      );

      return matchesStatus && matchesLayout && matchesSearch;
    });
  }, [jobs, search, statusFilter, layoutFilter]);

  const stats = useMemo(() => {
    const failed = jobs.filter(job => getJobStatus(job) === 'failed').length;
    const queued = jobs.filter(job => getJobStatus(job) === 'queued').length;
    const labels = jobs.reduce((sum, job) => sum + getStudentCount(job), 0);
    const sheets = jobs.reduce((sum, job) => {
      return sum + Math.ceil(getStudentCount(job) / getLabelsPerSheet(job.layout));
    }, 0);

    return {
      totalJobs: jobs.length,
      failed,
      queued,
      labels,
      sheets,
      latest: jobs[0],
    };
  }, [jobs]);

  const stockUsage = useMemo(() => {
    return stock.map(item => {
      const matchingJobs = jobs.filter(job => job.layout === item.template);
      const labelsPrinted = matchingJobs.reduce((sum, job) => sum + getStudentCount(job), 0);
      const estimatedSheetsUsed = matchingJobs.reduce((sum, job) => {
        return sum + Math.ceil(getStudentCount(job) / getLabelsPerSheet(job.layout));
      }, 0);
      const remainingAfterUsage = Math.max(0, item.currentStock - estimatedSheetsUsed);

      return {
        ...item,
        labelsPrinted,
        estimatedSheetsUsed,
        remainingAfterUsage,
        lowAfterUsage: remainingAfterUsage <= (item.lowStockThreshold || 0),
      };
    });
  }, [jobs, stock]);

  async function handleReprint(job: PrintJob) {
    setReprintJob(job);
    await fetch('/api/print-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        students: job.students || [],
        labelCount: getStudentCount(job),
        layout: job.layout,
        status: 'completed',
        reprintOf: job._id,
      }),
    }).catch(() => undefined);

    // Open preview only — do not auto-trigger the browser print dialog
  }

  function exportHistory() {
    const headers = ['Time', 'Status', 'User', 'Email', 'School', 'Layout', 'Labels', 'Students', 'Error'];
    const rows = filteredJobs.map(job => [
      formatDateTime(job.time),
      getJobStatus(job),
      job.user?.name || 'Unknown',
      job.user?.email || '',
      job.user?.school || '',
      getTemplateName(job.layout),
      getStudentCount(job),
      (job.students || []).map(student => `${student.firstName || ''} ${student.lastName || ''} (${student.studentId || ''})`.trim()).join('; '),
      job.error || '',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `print-history-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-background">
        <AdminHeader />
        <div className="w-full p-6 flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <div className="w-full p-6 space-y-6">
        {/* Back button */}
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Button>

        {/* Page header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 print:hidden">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Printer className="h-8 w-8" />
              Label Print Queue
            </h1>
            <p className="text-muted-foreground mt-1">
              Review print history, reprint jobs, and monitor label stock usage.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={fetchData}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button onClick={exportHistory} disabled={filteredJobs.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="print:hidden">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {stats.failed > 0 && (
          <Alert variant="destructive" className="print:hidden">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Failed print jobs found</AlertTitle>
            <AlertDescription>
              {stats.failed} job(s) are marked failed. Use the history table to review and reprint them.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 print:hidden">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Print Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalJobs}</div>
              <p className="text-xs text-muted-foreground">Recent history loaded</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Labels Printed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.labels}</div>
              <p className="text-xs text-muted-foreground">Across loaded jobs</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Estimated Sheets Used</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.sheets}</div>
              <p className="text-xs text-muted-foreground">Based on label layout</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Last Printed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-semibold truncate">
                {stats.latest ? formatDateTime(stats.latest.time) : 'None'}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.latest ? `${getStudentCount(stats.latest)} label(s)` : 'No print jobs yet'}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="print:hidden">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Find a print job by user, school, student, status, or layout.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="search">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="User, school, student, or ID"
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="queued">Queued</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Layout</Label>
                <Select value={layoutFilter} onValueChange={setLayoutFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All layouts</SelectItem>
                    {layoutOptions.map(layout => (
                      <SelectItem key={layout} value={layout}>
                        {getTemplateName(layout)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="print:hidden">
          <CardHeader>
            <CardTitle>Print History</CardTitle>
            <CardDescription>{filteredJobs.length} matching print job(s)</CardDescription>
          </CardHeader>
          <CardContent>
            {filteredJobs.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-3" />
                <p>No print jobs match the current filters.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Printed</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Students</TableHead>
                    <TableHead>Layout</TableHead>
                    <TableHead className="text-right">Labels</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredJobs.map(job => {
                    const jobStatus = getJobStatus(job);

                    return (
                      <TableRow key={job._id}>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDateTime(job.time)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={jobStatus === 'failed' ? 'destructive' : jobStatus === 'queued' ? 'secondary' : 'outline'}>
                            {jobStatus === 'failed' && <XCircle className="mr-1 h-3 w-3" />}
                            {jobStatus === 'completed' && <CheckCircle2 className="mr-1 h-3 w-3" />}
                            {jobStatus}
                          </Badge>
                          {job.error && (
                            <div className="text-xs text-destructive mt-1">{job.error}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{job.user?.name || 'Unknown'}</div>
                          <div className="text-xs text-muted-foreground">{job.user?.email || 'No email'}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(job.students || []).slice(0, 3).map((student, index) => (
                              <Badge key={`${student.studentId}-${index}`} variant="secondary" className="text-xs">
                                {student.firstName} {student.lastName}
                              </Badge>
                            ))}
                            {(job.students || []).length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{(job.students || []).length - 3} more
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{getTemplateName(job.layout)}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">{getStudentCount(job)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReprint(job)}
                            disabled={!job.students || job.students.length === 0}
                          >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Reprint
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="print:hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Label Stock Usage
            </CardTitle>
            <CardDescription>
              Estimated usage compares loaded print history against the current stock entries.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stockUsage.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No label stock entries found. Add stock entries from Label Stock Management.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Template</TableHead>
                    <TableHead className="text-right">Current Stock</TableHead>
                    <TableHead className="text-right">Labels Printed</TableHead>
                    <TableHead className="text-right">Estimated Sheets Used</TableHead>
                    <TableHead className="text-right">Projected Remaining</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockUsage.map(item => (
                    <TableRow key={item._id}>
                      <TableCell className="font-medium">{getTemplateName(item.template)}</TableCell>
                      <TableCell className="text-right">{item.currentStock}</TableCell>
                      <TableCell className="text-right">{item.labelsPrinted}</TableCell>
                      <TableCell className="text-right">{item.estimatedSheetsUsed}</TableCell>
                      <TableCell className="text-right">{item.remainingAfterUsage}</TableCell>
                      <TableCell>
                        <Badge variant={item.lowAfterUsage ? 'destructive' : 'outline'}>
                          {item.lowAfterUsage ? 'Reorder Soon' : 'OK'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {reprintJob && (
        <div className="hidden print:block p-6">
          <div className="space-y-4">
            {(reprintJob.students || []).map((student, index) => (
              <div key={`${student.studentId}-${index}`} className="border border-black p-4 break-inside-avoid">
                <div className="text-lg font-bold">
                  {student.firstName} {student.lastName}
                </div>
                <div>Student ID: {student.studentId || 'N/A'}</div>
                <div className="text-sm">Reprint from {formatDateTime(reprintJob.time)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
