'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import AdminHeader from '@/components/AdminHeader';
import {
  AlertTriangle, Download, ExternalLink, Loader2, Mail, MailCheck, MailQuestion, MailX,
  MapPin, Pencil, RefreshCw, Search, Users, X,
} from 'lucide-react';
import StudentAddressEditDialog, { type StudentAddressRecord } from '@/components/StudentAddressEditDialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { formatStudentAddressStacked } from '@/lib/addressValidation';
import { googleMapsSearchUrl } from '@/lib/googleMaps';
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
  address?: string;
  apt?: string;
  city?: string;
  state?: string;
  zip?: string;
  addressValidationStatus?: string;
  addressVerifiedAt?: string;
  addressWarnings?: string[];
  addressGeoclient?: {
    latitude?: number;
    longitude?: number;
  };
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

const ADDRESS_STATUS_OPTIONS = [
  { value: 'any',          label: 'All address statuses' },
  { value: 'empty',        label: 'No address on record' },
  { value: 'unverified',   label: 'Address not yet verified' },
  { value: 'verified',     label: 'Verified' },
  { value: 'warning',      label: 'Warning' },
  { value: 'not_found',    label: 'Not found' },
  { value: 'needs_review', label: 'Needs review' },
];

const LIMIT_OPTIONS = [25, 50, 100, 250];

type GeoclientResult = {
  status: string;
  warnings: string[];
  standardized?: { address: string; apt?: string; city: string; state: string; zip: string };
  geoclient?: { latitude?: number; longitude?: number };
};

function studentMapsUrl(
  student: Pick<Student, 'address' | 'apt' | 'city' | 'state' | 'zip' | 'addressGeoclient'>,
  geo?: GeoclientResult,
): string | null {
  const stacked = formatStudentAddressStacked(student);
  return googleMapsSearchUrl({
    latitude: geo?.geoclient?.latitude ?? student.addressGeoclient?.latitude,
    longitude: geo?.geoclient?.longitude ?? student.addressGeoclient?.longitude,
    address: stacked?.streetLine || student.address,
    city: student.city,
    state: student.state,
    zip: student.zip,
  });
}

function StackedAddress({ student }: { student: Pick<Student, 'address' | 'apt' | 'city' | 'state' | 'zip'> }) {
  const stacked = formatStudentAddressStacked(student);
  if (!stacked?.streetLine && !stacked?.cityStateZip) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  return (
    <div className="leading-snug max-w-[200px]">
      {stacked.streetLine ? (
        <div className="text-sm font-medium text-foreground break-words">{stacked.streetLine}</div>
      ) : null}
      {stacked.cityStateZip ? (
        <div className="text-xs text-muted-foreground mt-0.5 break-words">{stacked.cityStateZip}</div>
      ) : null}
    </div>
  );
}

function AddressStatusBadge({ status }: { status?: string }) {
  if (!status || status === 'empty') {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  const map: Record<string, { label: string; className: string }> = {
    verified:   { label: 'Verified',   className: 'bg-green-100 text-green-700 border-green-300' },
    warning:    { label: 'Warning',    className: 'bg-amber-100 text-amber-700 border-amber-300' },
    not_found:  { label: 'Not found',  className: 'bg-red-100 text-red-700 border-red-300' },
    unverified: { label: 'Unverified', className: 'bg-slate-100 text-slate-600 border-slate-300' },
    error:      { label: 'Error',      className: 'bg-red-100 text-red-700 border-red-300' },
  };
  const cfg = map[status];
  if (!cfg) return <Badge variant="outline" className="text-xs">{status}</Badge>;
  return <Badge variant="outline" className={`text-xs ${cfg.className}`}>{cfg.label}</Badge>;
}

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

function createdByDisplay(cb: Student['createdBy']): { primary: string; secondary?: string } {
  if (!cb) return { primary: 'Not recorded' };
  if (typeof cb === 'string') return { primary: cb };
  const primary = cb.name ?? cb.email ?? 'Not recorded';
  const secondary = cb.name && cb.email ? cb.email : undefined;
  return { primary, secondary };
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
  const [verifyMessage, setVerifyMessage] = useState('');

  const [geoclientConfigured, setGeoclientConfigured] = useState<boolean | null>(null);
  const [geoclientVerifying, setGeoclientVerifying] = useState(false);
  const [geoclientByStudentId, setGeoclientByStudentId] = useState<Record<string, GeoclientResult>>({});
  const [editingStudent, setEditingStudent] = useState<StudentAddressRecord | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Filter state
  const [search, setSearch]           = useState('');
  const [schoolFilter, setSchoolFilter] = useState('');
  const [emailStatus, setEmailStatus] = useState('any');
  const [addressStatus, setAddressStatus] = useState('any');

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [debouncedSearch, schoolFilter, emailStatus, addressStatus, limit]);

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
      if (addressStatus !== 'any') params.set('addressStatus', addressStatus);

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
  }, [page, limit, debouncedSearch, schoolFilter, emailStatus, addressStatus]);

  useEffect(() => {
    if (authStatus === 'unauthenticated') { router.replace('/admin'); return; }
    if (authStatus === 'authenticated' && !['Admin', 'Data Lead', 'Data Member'].includes(role)) {
      router.replace('/admin');
    }
  }, [authStatus, role, router]);

  useEffect(() => {
    if (authStatus === 'authenticated') fetchStudents();
  }, [authStatus, fetchStudents]);

  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    fetch('/api/admin/addresses/verify')
      .then(r => r.ok ? r.json() : null)
      .then(data => setGeoclientConfigured(data?.configured ?? false))
      .catch(() => setGeoclientConfigured(false));
  }, [authStatus]);

  async function runAddressVerify(opts: {
    studentIds?: string[];
    mode?: 'unverified';
    apply?: boolean;
  }) {
    setGeoclientVerifying(true);
    setError('');
    setVerifyMessage('');
    try {
      const res = await fetch('/api/admin/addresses/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: opts.mode,
          studentIds: opts.studentIds,
          school: schoolFilter || undefined,
          apply: opts.apply ?? false,
          limit: 50,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Address verification failed');

      const map: Record<string, GeoclientResult> = { ...geoclientByStudentId };
      for (const item of data.results || []) {
        if (!item.studentId) continue;
        map[item.studentId] = {
          status: item.status,
          warnings: item.warnings || [],
          standardized: item.standardized,
          geoclient: item.geoclient,
        };
      }
      setGeoclientByStudentId(map);

      const applied = data.applied ?? 0;
      const count = data.count ?? 0;
      if (opts.apply) {
        setVerifyMessage(
          count === 0
            ? (data.message || 'No addresses to verify.')
            : `Verified and saved ${applied} of ${count} address${count === 1 ? '' : 'es'}.`,
        );
        await fetchStudents();
      } else {
        setVerifyMessage(`Verified ${count} address${count === 1 ? '' : 'es'} (preview only — not saved).`);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Address verification failed');
    } finally {
      setGeoclientVerifying(false);
    }
  }

  function handleVerifyCurrentPage(apply: boolean) {
    const ids = students
      .filter(s => s.address?.trim())
      .map(s => s._id);
    if (ids.length === 0) {
      setVerifyMessage('No students with addresses on this page.');
      return;
    }
    runAddressVerify({ studentIds: ids, apply });
  }

  function handleVerifyUnverifiedBatch(apply: boolean) {
    runAddressVerify({ mode: 'unverified', apply });
  }

  async function handleApplyStandardized() {
    const ids = Object.entries(geoclientByStudentId)
      .filter(([, geo]) => geo.standardized && ['verified', 'warning'].includes(geo.status))
      .map(([id]) => id);
    if (ids.length === 0) {
      setVerifyMessage('No standardized addresses to apply. Run verification first.');
      return;
    }
    await runAddressVerify({ studentIds: ids, apply: true });
  }

  function openAddressEditor(student: Student) {
    setEditingStudent({
      _id: student._id,
      labelId: student.labelId,
      studentId: student.studentId,
      firstName: student.firstName,
      lastName: student.lastName,
      address: student.address,
      apt: student.apt,
      city: student.city,
      state: student.state,
      zip: student.zip,
      addressValidationStatus: student.addressValidationStatus,
    });
    setEditDialogOpen(true);
  }

  async function handleExport(overrideAddressStatus?: string) {
    setExporting(true);
    try {
      const params = new URLSearchParams({ format: 'csv', limit: '500' });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (schoolFilter)    params.set('school', schoolFilter);
      if (emailStatus !== 'any') params.set('emailStatus', emailStatus);
      const exportAddressStatus = overrideAddressStatus ?? (addressStatus !== 'any' ? addressStatus : '');
      if (exportAddressStatus) params.set('addressStatus', exportAddressStatus);

      const res = await fetch(`/api/admin/students/all?${params}`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      const suffix = exportAddressStatus === 'needs_review' ? '-address-issues' : '';
      a.download = `students${suffix}-${new Date().toISOString().slice(0, 10)}.csv`;
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
    setAddressStatus('any');
    setPage(1);
  };

  const hasFilters = search || schoolFilter || emailStatus !== 'any' || addressStatus !== 'any';
  const pageWithAddress = students.filter(s => s.address?.trim()).length;
  const pageVerified = students.filter(s => s.addressValidationStatus === 'verified').length;
  const pageAddressIssues = students.filter(s =>
    ['warning', 'not_found', 'error'].includes(s.addressValidationStatus || ''),
  ).length;
  const tableColSpan = isAdmin ? 11 : 10;
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
              Browse, verify addresses, and export student records for mailings.
              {!isAdmin && ' Showing students for your school only.'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchStudents} disabled={loading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              onClick={() => handleExport('needs_review')}
              disabled={exporting || loading}
              className="gap-2"
            >
              {exporting
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Download className="h-4 w-4" />
              }
              Export issues
            </Button>
            <Button onClick={() => handleExport()} disabled={exporting || loading} className="gap-2">
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
        {verifyMessage && (
          <Alert>
            <MapPin className="h-4 w-4" />
            <AlertDescription>{verifyMessage}</AlertDescription>
          </Alert>
        )}

        {geoclientConfigured === false && (
          <Alert>
            <MapPin className="h-4 w-4" />
            <AlertTitle>NYC Geoclient not configured</AlertTitle>
            <AlertDescription>
              Add <code className="text-xs">NYC_GEOCLIENT_SUBSCRIPTION_KEY</code> (or{' '}
              <code className="text-xs">NYC_GEOCLIENT_APP_KEY</code>) from the NYC API portal.
            </AlertDescription>
          </Alert>
        )}

        {geoclientConfigured && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-blue-200 bg-blue-50/60 dark:bg-blue-950/20 dark:border-blue-800 p-3">
            <MapPin className="h-4 w-4 text-blue-600 shrink-0" />
            <div className="flex-1 min-w-[200px]">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">NYC Geoclient address verification</p>
              <p className="text-xs text-blue-800/90 dark:text-blue-200/90">
                Verify student addresses against NYC records. Use filters to find unverified or flagged addresses.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 bg-background"
              disabled={geoclientVerifying || loading}
              onClick={() => handleVerifyCurrentPage(false)}
            >
              {geoclientVerifying
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Verifying…</>
                : <>Preview this page</>}
            </Button>
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              disabled={geoclientVerifying || loading}
              onClick={() => handleVerifyCurrentPage(true)}
            >
              Verify &amp; save this page
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={geoclientVerifying || loading}
              onClick={() => handleVerifyUnverifiedBatch(true)}
            >
              Verify unverified batch (50)
            </Button>
            {Object.keys(geoclientByStudentId).length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={geoclientVerifying}
                onClick={handleApplyStandardized}
              >
                Apply standardized
              </Button>
            )}
          </div>
        )}

        {/* Address status guide */}
        <Card className="border-dashed">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm font-medium">Using address status</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-4 text-sm text-muted-foreground space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="font-medium text-foreground text-xs mb-1">Status meanings</p>
                <ul className="space-y-1 text-xs">
                  <li><Badge variant="outline" className="text-[10px] bg-green-100 text-green-700 border-green-300 mr-1">Verified</Badge> NYC Geoclient matched the address</li>
                  <li><Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-700 border-amber-300 mr-1">Warning</Badge> Matched with issues — review the standardized line</li>
                  <li><Badge variant="outline" className="text-[10px] bg-red-100 text-red-700 border-red-300 mr-1">Not found</Badge> No NYC match — fix street, borough, or ZIP</li>
                  <li><Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-600 border-slate-300 mr-1">Unverified</Badge> Address on file but not checked yet</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-foreground text-xs mb-1">Typical workflow</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Filter by <strong className="text-foreground">Address not yet verified</strong> or <strong className="text-foreground">Needs review</strong></li>
                  <li>Run <strong className="text-foreground">Verify &amp; save this page</strong> or <strong className="text-foreground">Verify unverified batch</strong></li>
                  <li>Click the <strong className="text-foreground">pencil icon</strong> on a row to edit and re-verify an address</li>
                  <li>Use <strong className="text-foreground">Google Maps</strong> to confirm the location when verified</li>
                  <li>Export CSV when statuses look good for mail-merge</li>
                </ol>
              </div>
              <div>
                <p className="font-medium text-foreground text-xs mb-1">Data Lead / Data Member</p>
                <p className="text-xs">
                  Use this page to clean mailing lists before letters or labels go out.
                  Stats at the top show how many addresses on this page are verified vs. need attention.
                  New imports from <strong className="text-foreground">Bulk Upload</strong> can be verified there first, then reviewed here school-wide.
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground text-xs mb-1">Fixing bad addresses</p>
                <p className="text-xs">
                  Common fixes: wrong borough (Brooklyn vs Queens), missing hyphen in Queens block numbers (87-05),
                  typo in street name, or apartment on the wrong line. After correcting source data, run verify again —
                  standardized NYC formatting is saved automatically.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Total matched', value: total },
            { label: 'This page',     value: loading ? '…' : students.length },
            { label: 'With address',  value: loading ? '…' : pageWithAddress },
            { label: 'Verified addr', value: loading ? '…' : pageVerified },
            { label: 'Addr issues',   value: loading ? '…' : pageAddressIssues },
            { label: 'Valid emails',  value: loading ? '…' : students.filter(s => s.emailValidationStatus === 'VALID').length },
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
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 pt-0">
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
              <Label className="text-xs">Address Status</Label>
              <Select value={addressStatus} onValueChange={setAddressStatus}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ADDRESS_STATUS_OPTIONS.map(o => (
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
                  <TableHead className="hidden lg:table-cell min-w-[180px]">Address</TableHead>
                  <TableHead className="hidden md:table-cell">Addr Status</TableHead>
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
                    <TableCell colSpan={tableColSpan} className="text-center py-12 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                      Loading…
                    </TableCell>
                  </TableRow>
                )}
                {!loading && students.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={tableColSpan} className="text-center py-12 text-muted-foreground">
                      No students match your filters.
                    </TableCell>
                  </TableRow>
                )}
                {!loading && students.map(s => {
                  const geo = geoclientByStudentId[s._id];
                  const displayStatus = geo?.status ?? s.addressValidationStatus;
                  const displayStudent = geo?.standardized
                    ? { ...s, ...geo.standardized }
                    : s;

                  return (
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
                    <TableCell className="hidden lg:table-cell text-sm align-top py-3">
                      <div className="space-y-1">
                        {displayStudent.address || displayStudent.city ? (
                          <StackedAddress student={displayStudent} />
                        ) : (
                          <span className="text-muted-foreground text-xs">No address</span>
                        )}
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                            onClick={() => openAddressEditor(s)}
                          >
                            <Pencil className="h-3 w-3" />
                            {displayStudent.address ? 'Edit' : 'Add'}
                          </Button>
                          {(() => {
                            const mapsUrl = studentMapsUrl(
                              { ...displayStudent, addressGeoclient: s.addressGeoclient },
                              geo,
                            );
                            if (!mapsUrl) return null;
                            return (
                              <a
                                href={mapsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                              >
                                <ExternalLink className="h-3 w-3" />
                                Maps
                              </a>
                            );
                          })()}
                        </div>
                        {geo?.warnings?.length ? (
                          <div className="flex items-start gap-1 text-[10px] text-amber-700">
                            <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                            <span className="leading-tight">{geo.warnings[0]}</span>
                          </div>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <AddressStatusBadge status={displayStatus} />
                    </TableCell>
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
                    <TableCell className="hidden xl:table-cell text-xs align-top py-3">
                      {(() => {
                        const cb = createdByDisplay(s.createdBy);
                        return (
                          <div className="leading-snug max-w-[140px]">
                            <div className={cb.primary === 'Not recorded' ? 'text-muted-foreground italic' : 'text-foreground'}>
                              {cb.primary}
                            </div>
                            {cb.secondary ? (
                              <div className="text-[10px] text-muted-foreground truncate mt-0.5" title={cb.secondary}>
                                {cb.secondary}
                              </div>
                            ) : null}
                          </div>
                        );
                      })()}
                    </TableCell>
                  </TableRow>
                  );
                })}
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
          cabinet, drawer, address fields, address verification status, email, email status, sibling flag,
          and created-by fields. Use address filters with Geoclient verification to clean mailing lists.
        </p>

        <StudentAddressEditDialog
          student={editingStudent}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onSaved={() => {
            setGeoclientByStudentId(prev => {
              if (!editingStudent) return prev;
              const next = { ...prev };
              delete next[editingStudent._id];
              return next;
            });
            fetchStudents();
          }}
        />

      </main>
    </div>
  );
}
