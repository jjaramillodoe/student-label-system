'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, Inbox, Loader2, RefreshCw, ShieldAlert, Wrench } from 'lucide-react';
import AdminHeader from '@/components/AdminHeader';
import FixStudentAssignmentDialog from '@/components/FixStudentAssignmentDialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

type QueueStudent = {
  _id: string;
  studentId: string;
  name: string;
  dob: string;
  fiscalYear: string;
  status: string;
  email: string;
  school: string;
  cabinet: string;
  drawer: string;
  cabinetName: string;
  drawerName: string;
  issue: string;
  severity: 'error' | 'warning';
};

type QueueResponse = {
  summary: {
    total: number;
    errors: number;
    warnings: number;
    byIssue: Record<string, number>;
  };
  students: QueueStudent[];
};

function canAutoFix(issue: string) {
  if (issue.toLowerCase().includes('archive box')) return false;
  return true;
}

export default function UnassignedStudentsPage() {
  const [data, setData] = useState<QueueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [issueFilter, setIssueFilter] = useState('all');
  const [fixStudent, setFixStudent] = useState<QueueStudent | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkFixOpen, setBulkFixOpen] = useState(false);

  useEffect(() => {
    fetchQueue();
  }, []);

  async function fetchQueue() {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/unassigned-students');
      const response = await res.json();

      if (!res.ok) {
        throw new Error(response.error || 'Failed to load unassigned student queue');
      }

      setData(response);
      setSelectedIds([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load unassigned student queue');
    } finally {
      setLoading(false);
    }
  }

  const issues = useMemo(() => Object.keys(data?.summary.byIssue || {}).sort(), [data]);
  const filteredStudents = useMemo(() => {
    if (!data) return [];
    if (issueFilter === 'all') return data.students;
    return data.students.filter((student) => student.issue === issueFilter);
  }, [data, issueFilter]);

  const fixableSelected = selectedIds.filter((id) => {
    const row = filteredStudents.find((s) => s._id === id);
    return row && canAutoFix(row.issue);
  });

  return (
    <div className="w-full p-6 space-y-6">
      <AdminHeader />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
          <h1 className="text-3xl font-bold text-foreground">Unassigned Student Queue</h1>
          <p className="text-muted-foreground mt-1">
            Review students missing locations or assigned to invalid, full, or over-capacity drawers.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchQueue} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
          <Button asChild>
            <Link href="/admin/cabinets">Manage Cabinets</Link>
          </Button>
        </div>
      </div>

      {success && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
          <Inbox className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800 dark:text-green-200">Updated</AlertTitle>
          <AlertDescription className="text-green-700 dark:text-green-300">{success}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && !data ? (
        <Card>
          <CardContent className="py-12 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            Loading queue...
          </CardContent>
        </Card>
      ) : data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Queue Total</p>
                  <p className={`text-2xl font-bold ${data.summary.total > 0 ? 'text-destructive' : ''}`}>{data.summary.total}</p>
                </div>
                <Inbox className="h-8 w-8 text-muted-foreground" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Missing / Invalid</p>
                  <p className={`text-2xl font-bold ${data.summary.errors > 0 ? 'text-destructive' : ''}`}>{data.summary.errors}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-muted-foreground" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Full Drawer Warnings</p>
                  <p className="text-2xl font-bold">{data.summary.warnings}</p>
                </div>
                <ShieldAlert className="h-8 w-8 text-muted-foreground" />
              </CardContent>
            </Card>
          </div>

          {data.summary.total === 0 && (
            <Alert className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
              <Inbox className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertTitle className="text-green-800 dark:text-green-200">Queue is clear</AlertTitle>
              <AlertDescription className="text-green-700 dark:text-green-300">
                No students with missing, invalid, full, or over-capacity assignments were found.
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle>Students Needing Assignment Review</CardTitle>
                <CardDescription>
                  Showing {filteredStudents.length} of {data.students.length} queued student(s).
                </CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Select value={issueFilter} onValueChange={setIssueFilter}>
                  <SelectTrigger className="w-full sm:w-72">
                    <SelectValue placeholder="Filter by issue" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Issues</SelectItem>
                    {issues.map((issue) => (
                      <SelectItem key={issue} value={issue}>
                        {issue} ({data.summary.byIssue[issue]})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="default"
                  className="gap-2"
                  disabled={fixableSelected.length === 0}
                  onClick={() => setBulkFixOpen(true)}
                >
                  <Wrench className="h-4 w-4" />
                  Fix selected ({fixableSelected.length})
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {filteredStudents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No students match this filter.</p>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10" />
                        <TableHead>Student</TableHead>
                        <TableHead>Issue</TableHead>
                        <TableHead>Current Location</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>School</TableHead>
                        <TableHead className="text-right">Fix</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStudents.map((student) => {
                        const fixable = canAutoFix(student.issue);
                        return (
                          <TableRow key={`${student._id}-${student.issue}`}>
                            <TableCell>
                              {fixable ? (
                                <input
                                  type="checkbox"
                                  checked={selectedIds.includes(student._id)}
                                  onChange={(e) => {
                                    setSelectedIds((prev) =>
                                      e.target.checked
                                        ? [...new Set([...prev, student._id])]
                                        : prev.filter((id) => id !== student._id),
                                    );
                                  }}
                                  aria-label={`Select ${student.name}`}
                                />
                              ) : null}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{student.name}</div>
                              <div className="text-xs font-mono text-muted-foreground">{student.studentId || student._id}</div>
                              {student.email && (
                                <div className="text-xs text-muted-foreground">{student.email}</div>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={student.severity === 'error' ? 'destructive' : 'secondary'}>
                                {student.issue}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {student.cabinetName || student.drawerName ? (
                                <div>
                                  <div>{student.cabinetName || 'Unknown cabinet'}</div>
                                  <div className="text-xs text-muted-foreground">{student.drawerName || 'Unknown drawer'}</div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">Not assigned</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{student.status || '-'}</Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{student.school || '-'}</TableCell>
                            <TableCell className="text-right">
                              {fixable ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1"
                                  onClick={() => setFixStudent(student)}
                                >
                                  <Wrench className="h-3.5 w-3.5" />
                                  Fix
                                </Button>
                              ) : (
                                <Button size="sm" variant="ghost" asChild>
                                  <Link href="/admin/cabinets">Archive boxes</Link>
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <FixStudentAssignmentDialog
        open={!!fixStudent}
        onOpenChange={(open) => !open && setFixStudent(null)}
        studentIds={fixStudent ? [fixStudent._id] : []}
        studentLabel={fixStudent?.name}
        source="unassigned-queue"
        onDone={(message) => {
          setSuccess(message);
          setError('');
          fetchQueue();
        }}
      />
      <FixStudentAssignmentDialog
        open={bulkFixOpen}
        onOpenChange={setBulkFixOpen}
        studentIds={fixableSelected}
        source="unassigned-queue-bulk"
        onDone={(message) => {
          setSuccess(message);
          setError('');
          setSelectedIds([]);
          fetchQueue();
        }}
      />
    </div>
  );
}
