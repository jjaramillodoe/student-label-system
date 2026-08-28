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
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { formatFullName } from '@/lib/personName';
import { parseStudentsListResponse } from '@/lib/studentsList';
import { formatShortDate } from '@/lib/utils';
import { ISRF_ROLES, buildIsrfFieldValues, displayIsrfDateBox } from '@/lib/isrfForm';

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

  const mapped = useMemo(
    () => (selected ? buildIsrfFieldValues(selected) : null),
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
          Name, date of birth, address, phone, email, gender, original start date, and
          BE/ESL literacy flags when those fields exist. Date boxes are written as MMDDYYYY
          to match the form. SSN, employment, barriers, race/ethnicity, and the student
          signature stay blank for staff to complete.
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
          <CardDescription>Search by name, Label ID, Student ID, or date of birth.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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

          {hits.length > 0 && (
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
                {hits.map((row) => (
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
          )}
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
