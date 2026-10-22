'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Download, Eye, FilePen, Loader2, Search, UserRound,
} from 'lucide-react';
import PageIntro from '@/components/PageIntro';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatFullName } from '@/lib/personName';
import { parseStudentsListResponse } from '@/lib/studentsList';
import { formatShortDate } from '@/lib/utils';
import { ISRF_ROLES, buildIsrfFieldValues, displayIsrfDateBox, studentDocToIsrfInput } from '@/lib/isrfForm';

type StudentHit = {
  _id: string;
  firstName?: string;
  lastName?: string;
  dob?: string;
  labelId?: string;
  studentId?: string;
  school?: string;
  phone?: string;
  email?: string;
  gender?: string;
  address?: string;
  apt?: string;
  city?: string;
  state?: string;
  zip?: string;
  educationStatus?: string;
  startDate?: string;
  originalStartDate?: string;
  status?: string;
};

export default function GenerateIsrfPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = session?.user?.role;
  const allowed = Boolean(role && (ISRF_ROLES as readonly string[]).includes(role));

  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<StudentHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchMode, setSearchMode] = useState<'quick' | 'fields'>('quick');
  const [fields, setFields] = useState({ firstName: '', lastName: '', dob: '' });
  const [fieldHits, setFieldHits] = useState<StudentHit[]>([]);
  const [fieldSearching, setFieldSearching] = useState(false);
  const [fieldSearched, setFieldSearched] = useState(false);
  const [selected, setSelected] = useState<StudentHit | null>(null);
  const [generating, setGenerating] = useState<'preview' | 'download' | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/auth/signin');
      return;
    }
    if (!allowed) router.push('/');
  }, [status, session, allowed, router]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/students?search=${encodeURIComponent(q)}&limit=12&source=isrf`,
        );
        if (!res.ok) throw new Error('Search failed');
        const parsed = parseStudentsListResponse<StudentHit>(await res.json());
        if (!cancelled) setHits(parsed.students);
      } catch {
        if (!cancelled) {
          setHits([]);
          setError('Could not search students.');
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const hasFieldInput = Boolean(fields.firstName.trim() || fields.lastName.trim() || fields.dob);

  async function searchByFields(e: React.FormEvent) {
    e.preventDefault();
    if (!hasFieldInput) return;
    setError('');
    setFieldSearching(true);
    try {
      const params = new URLSearchParams({ limit: '25', source: 'isrf' });
      if (fields.firstName.trim()) params.set('firstName', fields.firstName.trim());
      if (fields.lastName.trim()) params.set('lastName', fields.lastName.trim());
      if (fields.dob) params.set('dob', fields.dob);
      const res = await fetch(`/api/students?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Search failed');
      }
      const parsed = parseStudentsListResponse<StudentHit>(await res.json());
      setFieldHits(parsed.students);
    } catch (err) {
      setFieldHits([]);
      setError(err instanceof Error ? err.message : 'Could not search students.');
    } finally {
      setFieldSearching(false);
      setFieldSearched(true);
    }
  }

  function clearFieldSearch() {
    setFields({ firstName: '', lastName: '', dob: '' });
    setFieldHits([]);
    setFieldSearched(false);
  }

  function renderHits(rows: StudentHit[]) {
    if (rows.length === 0) return null;
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>DOB</TableHead>
            <TableHead>IDs</TableHead>
            <TableHead>School</TableHead>
            <TableHead className="text-right"> </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row._id} className={selected?._id === row._id ? 'bg-muted/50' : undefined}>
              <TableCell className="font-medium">{formatFullName(row) || '—'}</TableCell>
              <TableCell>{formatShortDate(row.dob) || row.dob || '—'}</TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {[row.labelId, row.studentId].filter(Boolean).join(' · ') || '—'}
              </TableCell>
              <TableCell className="text-muted-foreground">{row.school || '—'}</TableCell>
              <TableCell className="text-right">
                <Button
                  size="sm"
                  variant={selected?._id === row._id ? 'default' : 'outline'}
                  onClick={() => {
                    setSelected(row);
                    setPreviewUrl((prev) => {
                      if (prev) URL.revokeObjectURL(prev);
                      return null;
                    });
                  }}
                >
                  Select
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  const mapped = useMemo(
    () => (selected ? buildIsrfFieldValues(studentDocToIsrfInput(selected as Record<string, unknown>)) : null),
    [selected],
  );

  async function generatePdf(mode: 'preview' | 'download') {
    if (!selected?._id) return;
    setError('');
    setGenerating(mode);
    try {
      const res = await fetch(`/api/isrf${mode === 'download' ? '?download=1' : ''}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selected._id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to generate ISRF');
      }
      const blob = await res.blob();
      if (mode === 'download') {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1]
          || 'ISRF.pdf';
        a.click();
        URL.revokeObjectURL(url);
      } else {
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate ISRF');
    } finally {
      setGenerating(null);
    }
  }

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
        eyebrow="Daily"
        title="Generate ISRF"
        description="Search an intake record and fill the FY2027 Individual Student Record Form with information already on file."
        icon={<FilePen className="h-5 w-5 text-primary" />}
      />

      <Alert>
        <AlertTitle>What this fills</AlertTitle>
        <AlertDescription className="text-sm">
          Name, date of birth, address, home and cell phones, email, gender, original start date,
          employment, race/ethnicity, emergency contact, and barriers when those fields exist
          on the intake record. Date boxes are written as MMDDYYYY to match the form.
          SSN and the student signature stay blank for staff to complete.
        </AlertDescription>
      </Alert>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Could not generate ISRF</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Find a student</CardTitle>
          <CardDescription>
            Use quick search to find a record as you type, or search by first name, last name,
            and date of birth together.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={searchMode} onValueChange={(v) => setSearchMode(v as 'quick' | 'fields')}>
            <TabsList>
              <TabsTrigger value="quick">Quick search</TabsTrigger>
              <TabsTrigger value="fields">By name &amp; DOB</TabsTrigger>
            </TabsList>

            <TabsContent value="quick" className="space-y-4 pt-2">
              <div className="relative max-w-lg">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name, Label ID, Student ID, or DOB…"
                  className="pl-9"
                  aria-label="Search students"
                />
              </div>

              {searching && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Searching…
                </p>
              )}

              {query.trim().length >= 2 && !searching && hits.length === 0 && (
                <p className="text-sm text-muted-foreground">No matching students.</p>
              )}

              {renderHits(hits)}
            </TabsContent>

            <TabsContent value="fields" className="space-y-4 pt-2">
              <form onSubmit={searchByFields} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl">
                  <div className="space-y-1.5">
                    <Label htmlFor="isrf-first-name">First name</Label>
                    <Input
                      id="isrf-first-name"
                      value={fields.firstName}
                      onChange={(e) => setFields((f) => ({ ...f, firstName: e.target.value }))}
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="isrf-last-name">Last name</Label>
                    <Input
                      id="isrf-last-name"
                      value={fields.lastName}
                      onChange={(e) => setFields((f) => ({ ...f, lastName: e.target.value }))}
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="isrf-dob">Date of birth</Label>
                    <Input
                      id="isrf-dob"
                      type="date"
                      value={fields.dob}
                      onChange={(e) => setFields((f) => ({ ...f, dob: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" className="gap-2" disabled={!hasFieldInput || fieldSearching}>
                    {fieldSearching
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Search className="h-4 w-4" />}
                    Search
                  </Button>
                  <Button type="button" variant="outline" onClick={clearFieldSearch} disabled={fieldSearching}>
                    Clear
                  </Button>
                </div>
              </form>

              {fieldSearched && !fieldSearching && fieldHits.length === 0 && (
                <p className="text-sm text-muted-foreground">No students match all of the fields entered.</p>
              )}

              {renderHits(fieldHits)}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {selected && mapped && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="h-5 w-5" />
              {formatFullName(selected)}
            </CardTitle>
            <CardDescription>
              Fields that will be written onto the FY2027 ISRF. Empty intake values stay blank on the form.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {selected.educationStatus && <Badge variant="secondary">{selected.educationStatus}</Badge>}
              {selected.status && <Badge variant="outline">{selected.status}</Badge>}
              {selected.studentId && <Badge variant="outline">{selected.studentId}</Badge>}
            </div>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Date of birth</dt>
                <dd>{displayIsrfDateBox(mapped.text['Birth Date']) || '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Original start date</dt>
                <dd>{displayIsrfDateBox(mapped.text['Original Program Start Date']) || '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Address</dt>
                <dd>
                  {[mapped.text.Address, mapped.text.City, mapped.text.State, mapped.text.Zip]
                    .filter(Boolean)
                    .join(', ') || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Phone</dt>
                <dd>
                  {[mapped.text.Phone, mapped.text.undefined, mapped.text.undefined_2].filter(Boolean).join('-') || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Email</dt>
                <dd>{mapped.text.email || '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Gender</dt>
                <dd>{mapped.radios['Gender Required'] || '—'}</dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-2">
              <Button className="gap-2" onClick={() => void generatePdf('preview')} disabled={Boolean(generating)}>
                {generating === 'preview'
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Eye className="h-4 w-4" />}
                Preview PDF
              </Button>
              <Button className="gap-2" variant="outline" onClick={() => void generatePdf('download')} disabled={Boolean(generating)}>
                {generating === 'download'
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Download className="h-4 w-4" />}
                Download PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {previewUrl && (
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>Filled fields are editable in Acrobat if you need to complete the rest of the form.</CardDescription>
          </CardHeader>
          <CardContent>
            <iframe
              title="ISRF preview"
              src={previewUrl}
              className="w-full min-h-[720px] rounded-md border bg-muted"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
