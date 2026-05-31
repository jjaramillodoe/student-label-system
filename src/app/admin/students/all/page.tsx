'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import AdminHeader from '@/components/AdminHeader';
import {
  Download, Loader2, Mail, MailCheck, MailQuestion, MailX,
  RefreshCw, Search, Users, X,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { getStudentStorageDisplay } from '@/lib/studentLocation';

interface Student {
  _id: string;
  labelId?: string;
  studentId?: string;
  firstName?: string;
  lastName?: string;
  dob?: string;
  school?: string;
  cabinet?: string;
  drawer?: string;
  cabinetName?: string;
  drawerName?: string;
  archived?: boolean;
  status?: string;
  archiveBoxLabel?: string;
  archiveLocation?: string;
  archiveSchoolYear?: string;
  email?: string;
  emailValidationStatus?: string;
  emailValidatedAt?: string;
  siblingConfirmed?: boolean;
  createdAt?: string;
  createdBy?: { name?: string; email?: string } | string;
}

const EMAIL_STATUS_OPTIONS = [
  { value: 'any',         label: 'All email statuses' },
  { value: 'none',        label: 'No email on record' },
  { value: 'unvalidated', label: 'Email not yet validated' },
  { value: 'VALID',       label: 'Valid' },
  { value: 'INVALID',     label: 'Invalid' },
  { value: 'CATCH_ALL',   label: 'Catch-all' },
  { value: 'UNKNOWN',     label: 'Unknown' },
];

const LIMIT_OPTIONS = [25, 50, 100, 250];

function EmailStatusBadge({ status }: { status?: string }) {
  if (!status) return <span className="text-muted-foreground text-xs">—</span>;
  const map: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    VALID:     { label: 'Valid',     className: 'bg-green-100 text-green-700 border-green-300',  icon: <MailCheck  className="h-3 w-3" /> },
    INVALID:   { label: 'Invalid',   className: 'bg-red-100 text-red-700 border-red-300',        icon: <MailX      className="h-3 w-3" /> },
    CATCH_ALL: { label: 'Catch-all', className: 'bg-amber-100 text-amber-700 border-amber-300',  icon: <Mail       className="h-3 w-3" /> },
    UNKNOWN:   { label: 'Unknown',   className: 'bg-gray-100 text-gray-600 border-gray-300',     icon: <MailQuestion className="h-3 w-3" /> },
  };
  const cfg = map[status];
  if (!cfg) return <Badge variant="outline" className="text-xs">{status}</Badge>;
  return (
    <Badge variant="outline" className={`gap-1 text-xs ${cfg.className}`}>
      {cfg.icon}{cfg.label}
    </Badge>
  );
}

function createdByName(cb: Student['createdBy']): string {
  if (!cb) return '—';
  if (typeof cb === 'string') return cb;
  return cb.name ?? cb.email ?? '—';
}

export default function AllStudentsPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const role = (session?.user as any)?.role ?? '';
  const isAdmin = role === 'Admin';

  const [students, setStudents]       = useState<Student[]>([]);
  const [total, setTotal]             = useState(0);
  const [totalPages, setTotalPages]   = useState(1);
  const [page, setPage]               = useState(1);
  const [limit, setLimit]             = useState(50);
  const [schools, setSchools]         = useState<string[]>([]);
  const [loading, setLoading]         = useState(false);
  const [exporting, setExporting]     = useState(false);
  const [error, setError]             = useState('');

  // Filter state
  const [search, setSearch]           = useState('');
  const [schoolFilter, setSchoolFilter] = useState('');
  const [emailStatus, setEmailStatus] = useState('any');

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [debouncedSearch, schoolFilter, emailStatus, limit]);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page:  String(page),
        limit: String(limit),
      });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (schoolFilter)    params.set('school', schoolFilter);
      if (emailStatus !== 'any') params.set('emailStatus', emailStatus);

      const res = await fetch(`/api/admin/students/all?${params}`);
      if (!res.ok) throw new Error('Failed to fetch students');
      const data = await res.json();
      setStudents(data.students);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      if (data.schools?.length) setSchools(data.schools);
    } catch (e: any) {
      setError(e.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, schoolFilter, emailStatus]);

  useEffect(() => {
    if (authStatus === 'unauthenticated') { router.replace('/admin'); return; }
    if (authStatus === 'authenticated' && !['Admin', 'Data Lead'].includes(role)) {
      router.replace('/admin');
    }
  }, [authStatus, role, router]);

  useEffect(() => {
    if (authStatus === 'authenticated') fetchStudents();
  }, [authStatus, fetchStudents]);

  async function handleExport() {
    setExporting(true);
    try {
      const params = new URLSearchParams({ format: 'csv', limit: '500' });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (schoolFilter)    params.set('school', schoolFilter);
      if (emailStatus !== 'any') params.set('emailStatus', emailStatus);

      const res = await fetch(`/api/admin/students/all?${params}`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `students-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message ?? 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  const clearFilters = () => {
    setSearch('');
    setSchoolFilter('');
    setEmailStatus('any');
    setPage(1);
  };

  const hasFilters = search || schoolFilter || emailStatus !== 'any';
  const start = (page - 1) * limit + 1;
  const end   = Math.min(page * limit, total);

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <main className="w-full px-4 sm:px-6 py-6 space-y-5">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              All Students
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Browse, filter, and export student records for communications.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchStudents} disabled={loading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={handleExport} disabled={exporting || loading} className="gap-2">
              {exporting
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Download className="h-4 w-4" />
              }
              Export CSV
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total matched', value: total },
            { label: 'This page',     value: loading ? '…' : students.length },
            { label: 'Valid emails',  value: loading ? '…' : students.filter(s => s.emailValidationStatus === 'VALID').length },
            { label: 'No email',      value: loading ? '…' : students.filter(s => !s.email).length },
          ].map(s => (
            <Card key={s.label} className="p-3">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-xl font-bold">{s.value}</p>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3 pt-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Search className="h-4 w-4" /> Filters
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="ml-auto h-7 gap-1 text-xs">
                  <X className="h-3 w-3" /> Clear
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-0">
            <div className="space-y-1.5">
              <Label className="text-xs">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Name, email, ID…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 h-9 text-sm"
                />
              </div>
            </div>

            {isAdmin && (
              <div className="space-y-1.5">
                <Label className="text-xs">School</Label>
                <Select value={schoolFilter || 'all'} onValueChange={v => setSchoolFilter(v === 'all' ? '' : v)}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="All schools" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All schools</SelectItem>
                    {schools.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Email Status</Label>
              <Select value={emailStatus} onValueChange={setEmailStatus}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMAIL_STATUS_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Rows per page</Label>
              <Select value={String(limit)} onValueChange={v => setLimit(Number(v))}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LIMIT_OPTIONS.map(n => (
                    <SelectItem key={n} value={String(n)}>{n} rows</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-36">Label ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">DOB</TableHead>
                  {isAdmin && <TableHead className="hidden lg:table-cell">School</TableHead>}
                  <TableHead>Email</TableHead>
                  <TableHead className="hidden sm:table-cell">Email Status</TableHead>
                  <TableHead className="hidden xl:table-cell">Box / Cabinet</TableHead>
                  <TableHead className="hidden xl:table-cell">Location / Drawer</TableHead>
                  <TableHead className="hidden xl:table-cell">Created By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                      Loading…
                    </TableCell>
                  </TableRow>
                )}
                {!loading && students.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                      No students match your filters.
                    </TableCell>
                  </TableRow>
                )}
                {!loading && students.map(s => (
                  <TableRow key={s._id}>
                    <TableCell className="font-mono text-xs">
                      <div className="font-medium">{s.labelId ?? s.studentId ?? '—'}</div>
                      {s.labelId && s.studentId && (
                        <div className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[130px]">{s.studentId}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {[s.lastName, s.firstName].filter(Boolean).join(', ') || '—'}
                      </div>
                      {s.siblingConfirmed && (
                        <Badge variant="outline" className="text-[10px] mt-0.5 bg-purple-50 text-purple-700 border-purple-200">
                          Sibling
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{s.dob || '—'}</TableCell>
                    {isAdmin && (
                      <TableCell className="hidden lg:table-cell text-sm">{s.school || '—'}</TableCell>
                    )}
                    <TableCell className="text-sm">
                      {s.email
                        ? <a href={`mailto:${s.email}`} className="text-blue-600 hover:underline truncate block max-w-[180px]">{s.email}</a>
                        : <span className="text-muted-foreground text-xs">—</span>
                      }
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <EmailStatusBadge status={s.emailValidationStatus} />
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-sm">
                      {(() => {
                        const loc = getStudentStorageDisplay(s);
                        return loc.primary !== '—' ? loc.primary : <span className="text-muted-foreground text-xs">—</span>;
                      })()}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-sm">
                      {(() => {
                        const loc = getStudentStorageDisplay(s);
                        return loc.secondary !== '—' ? loc.secondary : <span className="text-muted-foreground text-xs">—</span>;
                      })()}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-xs text-muted-foreground">
                      {createdByName(s.createdBy)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20 text-sm text-muted-foreground">
              <span>
                {loading ? '…' : `${start}–${end} of ${total.toLocaleString()}`}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline" size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1 || loading}
                >
                  Previous
                </Button>
                <span className="flex items-center px-2 text-xs">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline" size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || loading}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Export tip */}
        <p className="text-xs text-muted-foreground">
          The CSV export respects all active filters and includes Label ID, Student ID, name, DOB, school,
          cabinet, drawer, email, email status, sibling flag, and created-by fields.
          Use it to build a mailing list or mail-merge for student communications.
        </p>

      </main>
    </div>
  );
}
