'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  Archive,
  ArrowLeft,
  BarChart3,
  Download,
  Edit,
  FileText,
  Loader2,
  Plus,
  Printer,
  RefreshCw,
  Trash2,
  Users,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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

interface AuditLog {
  _id: string;
  action: string;
  student: any;
  time: string;
  user?: {
    name?: string;
    email?: string;
    role?: string;
    school?: string;
  } | null;
}

type ActivityType = 'added' | 'edited' | 'printed' | 'archived' | 'deleted' | 'other';

const ACTIVITY_META: Record<ActivityType, { label: string; icon: any; badge: string }> = {
  added: { label: 'Added', icon: Plus, badge: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  edited: { label: 'Edited', icon: Edit, badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  printed: { label: 'Printed', icon: Printer, badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
  archived: { label: 'Archived', icon: Archive, badge: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
  deleted: { label: 'Deleted', icon: Trash2, badge: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
  other: { label: 'Other', icon: Activity, badge: 'bg-muted text-muted-foreground' },
};

function getActivityType(action: string): ActivityType {
  const normalized = action.toLowerCase();

  if (normalized.includes('print')) return 'printed';
  if (normalized.includes('delete') || normalized.includes('clear')) return 'deleted';
  if (normalized.includes('archive')) return 'archived';
  if (normalized.includes('edit') || normalized.includes('update') || normalized.includes('move') || normalized.includes('restore')) return 'edited';
  if (normalized.includes('add') || normalized.includes('create') || normalized.includes('seed') || normalized.includes('import')) return 'added';

  return 'other';
}

function getStudentCount(student: any) {
  if (Array.isArray(student)) return student.length;
  return student ? 1 : 0;
}

function getInitials(name?: string) {
  if (!name) return 'U';
  return name
    .split(' ')
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';
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

export default function ActivityReportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rangeDays, setRangeDays] = useState('30');

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

    fetchLogs();
  }, [session, status, router]);

  async function fetchLogs() {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/audit-logs');
      if (!res.ok) throw new Error('Failed to fetch audit logs');
      const data = await res.json();
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('Failed to load activity report.');
    } finally {
      setLoading(false);
    }
  }

  const filteredLogs = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - Number(rangeDays));
    cutoff.setHours(0, 0, 0, 0);

    return logs.filter(log => {
      const logDate = new Date(log.time);
      return !Number.isNaN(logDate.getTime()) && logDate >= cutoff;
    });
  }, [logs, rangeDays]);

  const report = useMemo(() => {
    const actionCounts: Record<ActivityType, number> = {
      added: 0,
      edited: 0,
      printed: 0,
      archived: 0,
      deleted: 0,
      other: 0,
    };
    const userCounts = new Map<string, {
      name: string;
      email: string;
      role: string;
      school: string;
      total: number;
      studentTouches: number;
      lastActivity: string;
      counts: Record<ActivityType, number>;
    }>();

    for (const log of filteredLogs) {
      const type = getActivityType(log.action || '');
      actionCounts[type] += 1;

      const email = log.user?.email || 'unknown';
      const existing = userCounts.get(email) || {
        name: log.user?.name || 'Unknown User',
        email,
        role: log.user?.role || 'Unknown',
        school: log.user?.school || 'Unknown',
        total: 0,
        studentTouches: 0,
        lastActivity: log.time,
        counts: { added: 0, edited: 0, printed: 0, archived: 0, deleted: 0, other: 0 },
      };

      existing.total += 1;
      existing.studentTouches += getStudentCount(log.student);
      existing.counts[type] += 1;
      if (new Date(log.time) > new Date(existing.lastActivity)) {
        existing.lastActivity = log.time;
      }
      userCounts.set(email, existing);
    }

    const usersByActivity = Array.from(userCounts.values()).sort((a, b) => b.total - a.total);
    const topUser = usersByActivity[0];
    const totalStudentTouches = usersByActivity.reduce((sum, user) => sum + user.studentTouches, 0);

    return {
      actionCounts,
      usersByActivity,
      topUser,
      totalEvents: filteredLogs.length,
      totalStudentTouches,
      uniqueUsers: usersByActivity.length,
    };
  }, [filteredLogs]);

  function exportReport() {
    const headers = ['User', 'Email', 'Role', 'School', 'Total', 'Added', 'Edited', 'Printed', 'Archived', 'Deleted', 'Student Touches', 'Last Activity'];
    const rows = report.usersByActivity.map(user => [
      user.name,
      user.email,
      user.role,
      user.school,
      user.total,
      user.counts.added,
      user.counts.edited,
      user.counts.printed,
      user.counts.archived,
      user.counts.deleted,
      user.studentTouches,
      formatDateTime(user.lastActivity),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `activity-report-${rangeDays}-days-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="w-full p-6 flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="w-full p-6 space-y-6">
        {/* Back button */}
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Button>

        {/* Page header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <BarChart3 className="h-8 w-8" />
              Activity Report
            </h1>
            <p className="text-muted-foreground mt-1">
              See who added, edited, printed, archived, or deleted records.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={rangeDays} onValueChange={setRangeDays}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchLogs}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button onClick={exportReport} disabled={report.usersByActivity.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Activity Events</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{report.totalEvents}</div>
              <p className="text-xs text-muted-foreground">Last {rangeDays} days</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Users Active</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{report.uniqueUsers}</div>
              <p className="text-xs text-muted-foreground">People with logged actions</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Student Touches</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{report.totalStudentTouches}</div>
              <p className="text-xs text-muted-foreground">Single and bulk records affected</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Top User</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold truncate">{report.topUser?.name || 'None'}</div>
              <p className="text-xs text-muted-foreground">
                {report.topUser ? `${report.topUser.total} logged actions` : 'No activity yet'}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          {(Object.keys(ACTIVITY_META) as ActivityType[]).map((type) => {
            const Icon = ACTIVITY_META[type].icon;
            return (
              <Card key={type}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{ACTIVITY_META[type].label}</p>
                      <p className="text-2xl font-bold">{report.actionCounts[type]}</p>
                    </div>
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Activity By User
            </CardTitle>
            <CardDescription>
              Sorted by the highest number of logged actions in the selected window.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {report.usersByActivity.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-3" />
                <p>No activity found for the last {rangeDays} days.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>School</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Added</TableHead>
                    <TableHead className="text-right">Edited</TableHead>
                    <TableHead className="text-right">Printed</TableHead>
                    <TableHead className="text-right">Archived</TableHead>
                    <TableHead className="text-right">Deleted</TableHead>
                    <TableHead>Last Activity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.usersByActivity.map(user => (
                    <TableRow key={user.email}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{user.name}</div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{user.role}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{user.school}</TableCell>
                      <TableCell className="text-right font-medium">{user.total}</TableCell>
                      <TableCell className="text-right">{user.counts.added}</TableCell>
                      <TableCell className="text-right">{user.counts.edited}</TableCell>
                      <TableCell className="text-right">{user.counts.printed}</TableCell>
                      <TableCell className="text-right">{user.counts.archived}</TableCell>
                      <TableCell className="text-right">{user.counts.deleted}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDateTime(user.lastActivity)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest matching events from the selected reporting window.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredLogs.slice(0, 15).map(log => {
                const type = getActivityType(log.action || '');
                const Icon = ACTIVITY_META[type].icon;
                return (
                  <div key={log._id} className="flex items-center justify-between gap-4 rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-muted p-2">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-medium">{log.action}</div>
                        <div className="text-sm text-muted-foreground">
                          {log.user?.name || 'Unknown User'} affected {getStudentCount(log.student)} record(s)
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className={ACTIVITY_META[type].badge}>{ACTIVITY_META[type].label}</Badge>
                      <div className="text-xs text-muted-foreground mt-1">{formatDateTime(log.time)}</div>
                    </div>
                  </div>
                );
              })}
              {filteredLogs.length === 0 && (
                <div className="py-8 text-center text-muted-foreground">No recent activity to show.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
