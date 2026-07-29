'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import AdminHeader from '@/components/AdminHeader';
import { 
  ArrowLeft, 
  Search, 
  Filter, 
  Download, 
  Calendar,
  User,
  FileText,
  Trash2,
  Edit,
  Plus,
  Archive,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { formatFullName } from '@/lib/personName';

interface AuditLog {
  _id: string;
  action: string;
  student: any;
  time: string;
  user?: {
    name: string;
    email: string;
    role: string;
    school: string;
  } | null;
}

const ACTION_TYPES = [
  'All Actions'
];

const ACTION_ICONS: Record<string, any> = {
  'Add Student': Plus,
  'Edit Student': Edit,
  'Delete Student': Trash2,
  'Bulk Archive': Archive,
  'Bulk Update': RefreshCw,
  'Archive Student': Archive,
  'Restore Student': RefreshCw,
};

const ACTION_COLORS: Record<string, string> = {
  'Add Student': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'Edit Student': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  'Delete Student': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  'Bulk Archive': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  'Bulk Update': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  'Archive Student': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  'Restore Student': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
};

export default function AuditLogPage() {
  const { data: session, status } = useSession();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    studentSearch: '',
    action: 'All Actions',
    startDate: '',
    endDate: '',
    userEmail: 'all'
  });
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchLogs();
    }
  }, [status]);

  async function fetchLogs() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/audit-logs');
      if (!res.ok) throw new Error('Failed to fetch audit logs');
      const data = await res.json();
      setLogs(data);
    } catch (err) {
      setError('Failed to load audit logs');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const dynamicActionTypes = useMemo(() => {
    return ['All Actions', ...Array.from(new Set(logs.map(log => log.action).filter(Boolean))).sort()];
  }, [logs]);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = filters.search ? (
      log.action.toLowerCase().includes(filters.search.toLowerCase()) ||
      (log.user?.name || '').toLowerCase().includes(filters.search.toLowerCase()) ||
      (log.user?.email || '').toLowerCase().includes(filters.search.toLowerCase())
    ) : true;

    const matchesStudent = filters.studentSearch ? (
      Array.isArray(log.student) 
        ? log.student.some((s: any) => 
            (s.firstName || '').toLowerCase().includes(filters.studentSearch.toLowerCase()) ||
            (s.lastName || '').toLowerCase().includes(filters.studentSearch.toLowerCase()) ||
            (s.studentId || '').toLowerCase().includes(filters.studentSearch.toLowerCase()) ||
            (s.email || '').toLowerCase().includes(filters.studentSearch.toLowerCase())
          )
        : (
            (log.student?.firstName || '').toLowerCase().includes(filters.studentSearch.toLowerCase()) ||
            (log.student?.lastName || '').toLowerCase().includes(filters.studentSearch.toLowerCase()) ||
            (log.student?.studentId || '').toLowerCase().includes(filters.studentSearch.toLowerCase()) ||
            (log.student?.email || '').toLowerCase().includes(filters.studentSearch.toLowerCase())
          )
    ) : true;

    const matchesAction = filters.action === 'All Actions' || log.action === filters.action;
    
    const logDate = new Date(log.time);
    const matchesStartDate = filters.startDate ? logDate >= new Date(filters.startDate) : true;
    const matchesEndDate = filters.endDate ? logDate <= new Date(filters.endDate + 'T23:59:59') : true;
    
    const matchesUser = filters.userEmail === 'all' || !filters.userEmail ? true : log.user?.email === filters.userEmail;

    return matchesSearch && matchesStudent && matchesAction && matchesStartDate && matchesEndDate && matchesUser;
  });

  const uniqueUsers = Array.from(new Set(logs.map(log => log.user?.email).filter(Boolean)));

  const timelineStats = useMemo(() => {
    const uniqueUserCount = new Set(filteredLogs.map(log => log.user?.email).filter(Boolean)).size;
    const bulkCount = filteredLogs.filter(log => Array.isArray(log.student)).length;
    const actionCounts = filteredLogs.reduce((counts, log) => {
      counts[log.action] = (counts[log.action] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);
    const topAction = Object.entries(actionCounts).sort((a, b) => b[1] - a[1])[0];

    return {
      total: filteredLogs.length,
      uniqueUserCount,
      bulkCount,
      topAction: topAction ? `${topAction[0]} (${topAction[1]})` : 'None',
    };
  }, [filteredLogs]);

  function setDatePreset(days: number | 'today' | 'all') {
    if (days === 'all') {
      setFilters({ ...filters, startDate: '', endDate: '' });
      return;
    }

    const end = new Date();
    const start = new Date();
    if (days === 'today') {
      start.setHours(0, 0, 0, 0);
    } else {
      start.setDate(start.getDate() - days);
    }

    setFilters({
      ...filters,
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    });
  }

  function getInitials(name: string) {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  function formatStudentInfo(student: any) {
    if (Array.isArray(student)) {
      return `${student.length} student(s)`;
    }
    return `${formatFullName(student)} (${student?.studentId || 'N/A'})`.trim();
  }

  function exportToCSV() {
    const headers = ['Time', 'Action', 'User', 'User Email', 'Role', 'School', 'Student(s)', 'Raw Student Data'];
    const rows = filteredLogs.map(log => [
      new Date(log.time).toLocaleString(),
      log.action,
      log.user?.name || 'Unknown',
      log.user?.email || 'N/A',
      log.user?.role || 'N/A',
      log.user?.school || 'N/A',
      Array.isArray(log.student) 
        ? log.student.map((s: any) => `${formatFullName(s)} (${s.studentId})`).join('; ')
        : formatStudentInfo(log.student),
      JSON.stringify(log.student || {})
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  if (status === 'loading') {
    return (
      <div className="w-full p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="w-full p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>You must be logged in to view audit logs.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="w-full p-6 space-y-6">
      <AdminHeader />
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-foreground">Audit Log</h1>
          <p className="text-muted-foreground mt-2">
            Track all system actions and changes
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchLogs} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={exportToCSV} variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Matching Events</p>
            <p className="text-2xl font-bold">{timelineStats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Users Involved</p>
            <p className="text-2xl font-bold">{timelineStats.uniqueUserCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Bulk Events</p>
            <p className="text-2xl font-bold">{timelineStats.bulkCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Top Action</p>
            <p className="text-lg font-semibold truncate">{timelineStats.topAction}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
          <CardDescription>
            Filter audit logs by action, date, user, or search term
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">User / Action Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search user or action..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="studentSearch">Student Search</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="studentSearch"
                  placeholder="Name, ID, email..."
                  value={filters.studentSearch}
                  onChange={(e) => setFilters({ ...filters, studentSearch: e.target.value })}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="action">Action Type</Label>
              <Select
                value={filters.action}
                onValueChange={(value) => setFilters({ ...filters, action: value })}
              >
                <SelectTrigger id="action">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dynamicActionTypes.map(action => (
                    <SelectItem key={action} value={action}>{action}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user">User</Label>
              <Select
                value={filters.userEmail}
                onValueChange={(value) => setFilters({ ...filters, userEmail: value })}
              >
                <SelectTrigger id="user">
                  <SelectValue placeholder="All Users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {uniqueUsers.map(email => {
                    if (!email) return null;
                    const user = logs.find(l => l.user?.email === email)?.user;
                    return (
                      <SelectItem key={email} value={email}>
                        {user?.name || email}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setDatePreset('today')}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDatePreset(7)}>
              Last 7 Days
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDatePreset(30)}>
              Last 30 Days
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDatePreset(90)}>
              Last 90 Days
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilters({ search: '', studentSearch: '', action: 'All Actions', startDate: '', endDate: '', userEmail: 'all' })}
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error Message */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Audit Log Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Audit Logs</CardTitle>
              <CardDescription>
                Showing {filteredLogs.length} of {logs.length} log entries
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No audit logs found</p>
              {filters.search || filters.action !== 'All Actions' || filters.startDate || filters.endDate || (filters.userEmail && filters.userEmail !== 'all') ? (
                <p className="text-sm mt-2">Try adjusting your filters</p>
              ) : null}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Student(s)</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log, idx) => {
                    const ActionIcon = ACTION_ICONS[log.action] || FileText;
                    const actionColor = ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-800';
                    const isBulk = Array.isArray(log.student);

                    return (
                      <TableRow key={idx} className="hover:bg-muted/50">
                        <TableCell className="font-mono text-xs">
                          {new Date(log.time).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge className={actionColor}>
                            <ActionIcon className="h-3 w-3 mr-1" />
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {log.user ? (
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="text-xs">
                                  {getInitials(log.user.name)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium text-sm">{log.user.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {log.user.email}
                                </div>
                                <div className="flex gap-1 mt-1">
                                  <Badge variant="outline" className="text-xs">
                                    {log.user.role}
                                  </Badge>
                                  <Badge variant="secondary" className="text-xs">
                                    {log.user.school}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">Unknown</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isBulk ? (
                            <div className="space-y-1">
                              <Badge variant="secondary">
                                {log.student.length} student(s)
                              </Badge>
                              <div className="text-xs text-muted-foreground">
                                {log.student.slice(0, 2).map((s: any, i: number) => (
                                  <div key={i}>
                                    {formatFullName(s)} ({s.studentId})
                                  </div>
                                ))}
                                {log.student.length > 2 && (
                                  <div>+{log.student.length - 2} more...</div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm">
                              <div className="font-medium">
                                {formatFullName(log.student)}
                              </div>
                              <div className="text-xs text-muted-foreground font-mono">
                                {log.student?.studentId}
                              </div>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedLog(log);
                              setShowDetails(true);
                            }}
                          >
                            View Details
                          </Button>
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

      {/* Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Audit Log Details</DialogTitle>
            <DialogDescription>
              Complete information about this audit log entry
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-semibold">Action</Label>
                  <div className="mt-1">
                    <Badge className={ACTION_COLORS[selectedLog.action] || 'bg-gray-100'}>
                      {selectedLog.action}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-semibold">Time</Label>
                  <div className="mt-1 text-sm font-mono">
                    {new Date(selectedLog.time).toLocaleString()}
                  </div>
                </div>
              </div>

              {selectedLog.user && (
                <div>
                  <Label className="text-sm font-semibold">User Information</Label>
                  <Card className="mt-2">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback>
                            {getInitials(selectedLog.user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{selectedLog.user.name}</div>
                          <div className="text-sm text-muted-foreground">{selectedLog.user.email}</div>
                          <div className="flex gap-2 mt-1">
                            <Badge variant="outline">{selectedLog.user.role}</Badge>
                            <Badge variant="secondary">{selectedLog.user.school}</Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              <div>
                <Label className="text-sm font-semibold">Student Information</Label>
                <Card className="mt-2">
                  <CardContent className="pt-4">
                    <pre className="text-xs bg-muted p-4 rounded-md overflow-x-auto">
                      {JSON.stringify(selectedLog.student, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

