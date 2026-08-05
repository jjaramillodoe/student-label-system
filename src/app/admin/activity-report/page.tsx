'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  Archive,
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
import PageIntro from '@/components/PageIntro';
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
  added: { label: 'Added', icon: Plus, badge: 'ui-badge-success' },
  edited: { label: 'Edited', icon: Edit, badge: 'ui-badge-info' },
  printed: { label: 'Printed', icon: Printer, badge: 'ui-badge-muted' },
  archived: { label: 'Archived', icon: Archive, badge: 'ui-badge-warning' },
  deleted: { label: 'Deleted', icon: Trash2, badge: 'ui-badge-danger' },
  other: { label: 'Other', icon: Activity, badge: 'ui-badge-muted' },
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
      <div className="w-full flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <div className="w-full space-y-6">
        <PageIntro
          eyebrow="Admin"
          title="Activity Report"
          description="See who added, edited, printed, archived, or deleted records."
          icon={<BarChart3 className="h-5 w-5 text-primary" />}
          actions={
            <>
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
            </>
          }
        />

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap gap-x-8 gap-y-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Activity events</p>
            <p className="text-xl font-semibold tabular-nums tracking-tight">{report.totalEvents}</p>
            <p className="text-[11px] text-muted-foreground">Last {rangeDays} days</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Users active</p>
            <p className="text-xl font-semibold tabular-nums tracking-tight">{report.uniqueUsers}</p>
            <p className="text-[11px] text-muted-foreground">People with logged actions</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Student touches</p>
            <p className="text-xl font-semibold tabular-nums tracking-tight">{report.totalStudentTouches}</p>
            <p className="text-[11px] text-muted-foreground">Single and bulk records</p>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Top user</p>
            <p className="text-sm font-semibold truncate">{report.topUser?.name || 'None'}</p>
            <p className="text-[11px] text-muted-foreground">
              {report.topUser ? `${report.topUser.total} logged actions` : 'No activity yet'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-3 rounded-lg border border-border px-4 py-3">
          {(Object.keys(ACTIVITY_META) as ActivityType[]).map((type) => {
            const Icon = ACTIVITY_META[type].icon;
            return (
              <div key={type} className="flex items-center gap-2 min-w-[5.5rem]">
                <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{ACTIVITY_META[type].label}</p>
                  <p className="text-lg font-semibold tabular-nums tracking-tight">{report.actionCounts[type]}</p>
                </div>
              </div>
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
                      <span className={ACTIVITY_META[type].badge}>{ACTIVITY_META[type].label}</span>
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
  );
}
