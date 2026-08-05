'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Archive,
  CalendarX,
  CheckCircle2,
  Loader2,
  MailWarning,
  RefreshCw,
  Sparkles,
  Wrench,
} from 'lucide-react';
import PageIntro from '@/components/PageIntro';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type CleanupStudent = {
  _id: string;
  studentId: string;
  name: string;
  email: string;
  dob: string;
  startDate: string;
  endDate: string;
  fiscalYear: string;
  status: string;
  archived: boolean;
  cabinet: string;
  drawer: string;
  school: string;
  issue: string;
};

type CleanupData = {
  summary: {
    scanned: number;
    invalidEmails: number;
    missingDates: number;
    oldInactive: number;
    archivedAssigned: number;
    totalIssues: number;
  };
  invalidEmails: CleanupStudent[];
  missingDates: CleanupStudent[];
  oldInactive: CleanupStudent[];
  archivedAssigned: CleanupStudent[];
};

const EMPTY_DATA: CleanupData = {
  summary: {
    scanned: 0,
    invalidEmails: 0,
    missingDates: 0,
    oldInactive: 0,
    archivedAssigned: 0,
    totalIssues: 0,
  },
  invalidEmails: [],
  missingDates: [],
  oldInactive: [],
  archivedAssigned: [],
};

function StudentIssueTable({ students }: { students: CleanupStudent[] }) {
  if (students.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <CheckCircle2 className="h-8 w-8 mx-auto mb-2" />
        No issues in this category.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Student</TableHead>
          <TableHead>Issue</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Dates</TableHead>
          <TableHead>Location</TableHead>
          <TableHead>School</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {students.slice(0, 25).map(student => (
          <TableRow key={student._id}>
            <TableCell>
              <div className="font-medium">{student.name}</div>
              <div className="text-xs text-muted-foreground">
                {student.studentId || 'No student ID'} {student.email ? `- ${student.email}` : ''}
              </div>
            </TableCell>
            <TableCell className="max-w-[260px]">
              <span className="text-sm">{student.issue}</span>
            </TableCell>
            <TableCell>
              <div className="flex gap-1 flex-wrap">
                <Badge variant={student.archived ? 'secondary' : 'outline'}>
                  {student.archived ? 'Archived' : 'Not archived'}
                </Badge>
                {student.status && <Badge variant="outline">{student.status}</Badge>}
              </div>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              <div>DOB: {student.dob || '-'}</div>
              <div>Start: {student.startDate || '-'}</div>
              {student.endDate && <div>End: {student.endDate}</div>}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {student.cabinet && student.drawer ? `${student.cabinet} / ${student.drawer}` : '-'}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">{student.school || '-'}</TableCell>
          </TableRow>
        ))}
        {students.length > 25 && (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground">
              Showing 25 of {students.length} records. Use bulk action or refine records from the dashboard.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

export default function DataCleanupPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<CleanupData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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

    fetchCleanupData();
  }, [session, status, router]);

  async function fetchCleanupData() {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/data-cleanup');
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to scan data');
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scan data cleanup issues.');
    } finally {
      setLoading(false);
    }
  }

  async function runCleanupAction(action: string, students: CleanupStudent[], label: string) {
    if (students.length === 0) return;
    if (!confirm(`Run "${label}" for ${students.length} student record(s)?`)) return;

    setActionLoading(action);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/admin/data-cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          ids: students.map(student => student._id),
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Cleanup action failed');

      setSuccess(`${label} completed for ${result.updated || 0} record(s).`);
      await fetchCleanupData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cleanup action failed.');
    } finally {
      setActionLoading('');
    }
  }

  const issueCards = useMemo(() => [
    {
      label: 'Invalid Emails',
      value: data.summary.invalidEmails,
      icon: MailWarning,
      description: 'Emails that will not validate.',
    },
    {
      label: 'Missing Dates',
      value: data.summary.missingDates,
      icon: CalendarX,
      description: 'Missing or invalid DOB/start dates.',
    },
    {
      label: 'Old Inactive',
      value: data.summary.oldInactive,
      icon: Archive,
      description: 'Inactive over 1 year and not archived.',
    },
    {
      label: 'Archived Assigned',
      value: data.summary.archivedAssigned,
      icon: AlertTriangle,
      description: 'Archived records still using drawer space.',
    },
  ], [data]);

  if (status === 'loading' || loading) {
    return (
      <div className="w-full flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <div className="w-full space-y-6">
        <PageIntro
          eyebrow="Admin"
          title="Data Cleanup Center"
          description="Find invalid emails, missing dates, stale inactive records, and archived students still assigned to drawers."
          icon={<Sparkles className="h-5 w-5 text-primary" />}
          actions={
            <Button variant="outline" onClick={fetchCleanupData}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Rescan
            </Button>
          }
        />

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {data.summary.totalIssues === 0 && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>All clear</AlertTitle>
            <AlertDescription>No cleanup issues were found across {data.summary.scanned} scanned student record(s).</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap gap-x-8 gap-y-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Students scanned</p>
            <p className="text-xl font-semibold tabular-nums tracking-tight">{data.summary.scanned}</p>
            <p className="text-[11px] text-muted-foreground">{data.summary.totalIssues} total issue(s)</p>
          </div>
          {issueCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label}>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                  <Icon className="h-3 w-3" />
                  {card.label}
                </p>
                <p className="text-xl font-semibold tabular-nums tracking-tight">{card.value}</p>
                <p className="text-[11px] text-muted-foreground max-w-[12rem]">{card.description}</p>
              </div>
            );
          })}
        </div>

        <Card>
          <CardHeader className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MailWarning className="h-5 w-5" />
                Invalid Emails
              </CardTitle>
              <CardDescription>Clear invalid emails so they do not block imports, exports, or future messaging.</CardDescription>
            </div>
            <Button
              onClick={() => runCleanupAction('clear-invalid-emails', data.invalidEmails, 'Clear invalid emails')}
              disabled={data.invalidEmails.length === 0 || actionLoading === 'clear-invalid-emails'}
            >
              {actionLoading === 'clear-invalid-emails' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wrench className="mr-2 h-4 w-4" />}
              Clear Invalid Emails
            </Button>
          </CardHeader>
          <CardContent>
            <StudentIssueTable students={data.invalidEmails} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarX className="h-5 w-5" />
              Missing Or Invalid Dates
            </CardTitle>
            <CardDescription>
              These need manual review because DOB and start date values should come from source records.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StudentIssueTable students={data.missingDates} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Archive className="h-5 w-5" />
                Old Inactive Students
              </CardTitle>
              <CardDescription>Archive inactive, withdrawn, graduated, or transferred records older than one year.</CardDescription>
            </div>
            <Button
              onClick={() => runCleanupAction('archive-old-inactive', data.oldInactive, 'Archive old inactive students')}
              disabled={data.oldInactive.length === 0 || actionLoading === 'archive-old-inactive'}
            >
              {actionLoading === 'archive-old-inactive' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Archive className="mr-2 h-4 w-4" />}
              Archive Old Inactive
            </Button>
          </CardHeader>
          <CardContent>
            <StudentIssueTable students={data.oldInactive} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Archived But Assigned
              </CardTitle>
              <CardDescription>Free drawer capacity by removing cabinet/drawer assignments from archived records.</CardDescription>
            </div>
            <Button
              onClick={() => runCleanupAction('unassign-archived', data.archivedAssigned, 'Unassign archived students')}
              disabled={data.archivedAssigned.length === 0 || actionLoading === 'unassign-archived'}
            >
              {actionLoading === 'unassign-archived' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wrench className="mr-2 h-4 w-4" />}
              Unassign Archived
            </Button>
          </CardHeader>
          <CardContent>
            <StudentIssueTable students={data.archivedAssigned} />
          </CardContent>
        </Card>
    </div>
  );
}
