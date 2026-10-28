'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Loader2, Search, StickyNote } from 'lucide-react';
import PageIntro from '@/components/PageIntro';
import StudentNotesDialog, { type NotesStudent } from '@/components/StudentNotesDialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { formatFullName } from '@/lib/personName';
import { STUDENT_NOTES_PAGE_ROLES } from '@/lib/studentNotes';
import { formatShortDate } from '@/lib/utils';

type NotedStudent = {
  student: {
    _id: string;
    firstName?: string;
    lastName?: string;
    dob?: string;
    labelId?: string;
    studentId?: string;
    school?: string;
    status?: string;
    archived?: boolean;
  };
  noteCount: number;
  latest: {
    _id: string;
    body: string;
    createdAt: string;
    createdBy?: { email?: string; name?: string | null };
  };
};

const RANGE_OPTIONS = [
  { value: '', label: 'All time' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

export default function StudentNotesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = session?.user?.role;
  const allowed = Boolean(role && (STUDENT_NOTES_PAGE_ROLES as readonly string[]).includes(role));

  const [rows, setRows] = useState<NotedStudent[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [days, setDays] = useState('');
  const [mine, setMine] = useState(false);
  const [filter, setFilter] = useState('');
  const [openStudent, setOpenStudent] = useState<NotesStudent | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/auth/signin');
      return;
    }
    if (!allowed) router.push('/');
  }, [status, session, allowed, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (days) params.set('days', days);
      if (mine) params.set('mine', '1');
      const res = await fetch(`/api/notes?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not load notes');
      setRows(data.students || []);
      setTruncated(Boolean(data.truncated));
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : 'Could not load notes');
    } finally {
      setLoading(false);
    }
  }, [days, mine]);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(({ student, latest }) =>
      [formatFullName(student), student.labelId, student.studentId, latest.body]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)));
  }, [rows, filter]);

  if (status === 'loading' || !allowed) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Students"
        title="Student Notes"
        description="Students with staff notes, most recent activity first. Open a student to see their full timeline."
        icon={<StickyNote className="h-5 w-5 text-primary" />}
      />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Students with notes</CardTitle>
          <CardDescription>
            {loading
              ? 'Loading…'
              : `${visible.length} student${visible.length === 1 ? '' : 's'}${truncated ? ' (showing the 200 most recent)' : ''}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter by name, ID, or note text…"
                className="pl-9"
                aria-label="Filter students with notes"
              />
            </div>
            <select
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="h-10 rounded-md border bg-background px-3 text-sm"
              aria-label="Date range"
            >
              {RANGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <Button variant={mine ? 'default' : 'outline'} onClick={() => setMine((v) => !v)}>
              Written by me
            </Button>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading notes…
            </p>
          ) : visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No students with notes yet. Add one from the dashboard: open a student&apos;s ⋮ menu and choose Notes.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>DOB</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Latest note</TableHead>
                  <TableHead className="text-right"> </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map(({ student, noteCount, latest }) => (
                  <TableRow key={student._id}>
                    <TableCell>
                      <div className="font-medium">{formatFullName(student) || '—'}</div>
                      <div className="text-xs text-muted-foreground">
                        {[student.labelId, student.school].filter(Boolean).join(' · ')}
                      </div>
                    </TableCell>
                    <TableCell>{formatShortDate(student.dob) || student.dob || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{noteCount}</Badge>
                      {student.archived && <Badge variant="outline" className="ml-1">Archived</Badge>}
                    </TableCell>
                    <TableCell className="max-w-md">
                      <p className="text-sm line-clamp-2 break-words">{latest.body}</p>
                      <p className="text-xs text-muted-foreground">
                        {latest.createdBy?.name || latest.createdBy?.email}
                        {' · '}
                        {formatShortDate(latest.createdAt) || latest.createdAt}
                      </p>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setOpenStudent({ _id: student._id, name: formatFullName(student) })}
                      >
                        Open timeline
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <StudentNotesDialog
        student={openStudent}
        onClose={() => {
          setOpenStudent(null);
          void load();
        }}
      />
    </div>
  );
}
