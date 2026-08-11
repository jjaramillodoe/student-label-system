'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle, Database, Download, Loader2, RefreshCw, Search,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { formatFullName } from '@/lib/personName';
import type { GarbageFlag, LegacyReviewRow, LiveMatchSummary } from '@/lib/legacyRosterReview';

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const lines = [
    headers.map(csvEscape).join(','),
    ...rows.map((row) => row.map(csvEscape).join(',')),
  ];
  const blob = new Blob([`${lines.join('\n')}\n`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function reviewRowsToCsv(rows: LegacyReviewRow[]): string[][] {
  return rows.map((row) => [
    row.firstName || '',
    row.lastName || '',
    row.dob || '',
    row.externalId || '',
    row.garbage.map((g) => g.label).join('; '),
    row.liveMatches
      .map((m) => `${formatFullName(m)} (${matchKindLabel(m.matchKind)}${m.similarity ? ` ${m.similarity}%` : ''})`)
      .join('; '),
    row.sourceTable || '',
  ]);
}

type ReviewSummary = {
  rosterCount: number;
  liveCount: number;
  garbage: number;
  exactInSystem: number;
  fuzzyInSystem: number;
  idConflicts: number;
  legacyOnly: number;
  withinLegacyDupes: number;
};

type ReviewPayload = {
  school: string;
  meta?: {
    filename?: string;
    rowCount?: number;
    uploadedAt?: string;
    sourceType?: string;
    tableName?: string;
  } | null;
  summary: ReviewSummary;
  garbage: LegacyReviewRow[];
  exactMatches: LegacyReviewRow[];
  fuzzyMatches: LegacyReviewRow[];
  idConflicts: LegacyReviewRow[];
  legacyOnlySample: LegacyReviewRow[];
  withinLegacyDupes: Array<{
    key: string;
    rows: Array<{ _id: string; firstName: string; lastName: string; dob: string; externalId?: string }>;
  }>;
  message?: string;
};

function flagClass(severity: GarbageFlag['severity']) {
  if (severity === 'error') return 'ui-badge-danger';
  if (severity === 'warning') return 'ui-badge-warning';
  return 'ui-badge-muted';
}

function matchKindLabel(kind: LiveMatchSummary['matchKind']) {
  switch (kind) {
    case 'exact_name_dob': return 'Exact name+DOB';
    case 'external_id': return 'Same ASISTS ID';
    case 'id_name_conflict': return 'ID match, name differs';
    case 'fuzzy': return 'Fuzzy name';
    default: return kind;
  }
}

function LegacyRowTable({
  rows,
  empty,
  showMatches = true,
}: {
  rows: LegacyReviewRow[];
  empty: string;
  showMatches?: boolean;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">{empty}</p>;
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Legacy (MDB)</TableHead>
            <TableHead>DOB</TableHead>
            <TableHead>ASISTS ID</TableHead>
            <TableHead>Issues</TableHead>
            {showMatches && <TableHead>In this system</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row._id}>
              <TableCell>
                <div className="font-medium text-sm">
                  {formatFullName({ firstName: row.firstName, lastName: row.lastName })}
                </div>
                {row.sourceTable && (
                  <div className="text-[10px] text-muted-foreground">{row.sourceTable}</div>
                )}
              </TableCell>
              <TableCell className="text-xs tabular-nums whitespace-nowrap">{row.dob || '—'}</TableCell>
              <TableCell className="font-mono text-xs">{row.externalId || '—'}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {row.garbage.length === 0 ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    row.garbage.map((g) => (
                      <span
                        key={`${row._id}-${g.code}`}
                        className={`${flagClass(g.severity)} text-[10px]`}
                        title={g.label}
                      >
                        {g.label}
                      </span>
                    ))
                  )}
                </div>
              </TableCell>
              {showMatches && (
                <TableCell>
                  {row.liveMatches.length === 0 ? (
                    <span className="text-xs text-muted-foreground">No live match</span>
                  ) : (
                    <ul className="space-y-1">
                      {row.liveMatches.map((m) => (
                        <li key={m._id} className="text-xs">
                          <Link
                            href={`/admin/students?q=${encodeURIComponent(m.labelId || m.studentId || m.lastName)}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {formatFullName(m)}
                          </Link>
                          <span className="text-muted-foreground">
                            {' · '}
                            {matchKindLabel(m.matchKind)}
                            {m.similarity ? ` · ${m.similarity}%` : ''}
                          </span>
                          {(m.labelId || m.studentId) && (
                            <span className="block font-mono text-[10px] text-muted-foreground">
                              {m.labelId || m.studentId}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function LegacyRosterReviewPanel({
  role,
  userSchool,
  initialSchool = '',
}: {
  role?: string;
  userSchool?: string;
  initialSchool?: string;
}) {
  const [schools, setSchools] = useState<string[]>([]);
  const [school, setSchool] = useState(initialSchool || userSchool || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<ReviewPayload | null>(null);
  const [section, setSection] = useState<'garbage' | 'idConflicts' | 'fuzzy' | 'exact' | 'legacyOnly' | 'dupes'>('garbage');

  useEffect(() => {
    if (role === 'Data Lead' && userSchool) {
      setSchool(userSchool);
      return;
    }
    if (initialSchool) setSchool(initialSchool);
  }, [role, userSchool, initialSchool]);

  useEffect(() => {
    if (role !== 'Admin') return;
    void (async () => {
      try {
        const res = await fetch('/api/admin/schools');
        if (!res.ok) return;
        const list = await res.json();
        const names = (Array.isArray(list) ? list : [])
          .map((s: { name?: string; active?: boolean }) => s.name)
          .filter((n: unknown): n is string => typeof n === 'string' && n.trim().length > 0)
          .sort((a: string, b: string) => a.localeCompare(b));
        setSchools(names);
        setSchool((prev) => prev || initialSchool || names[0] || '');
      } catch {
        /* ignore */
      }
    })();
  }, [role, initialSchool]);

  const load = useCallback(async () => {
    if (!school) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/legacy-roster/review?school=${encodeURIComponent(school)}`);
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Failed to review roster');
      setData(payload);
      // Prefer the most actionable section with results
      if (payload.summary?.garbage > 0) setSection('garbage');
      else if (payload.summary?.idConflicts > 0) setSection('idConflicts');
      else if (payload.summary?.fuzzyInSystem > 0) setSection('fuzzy');
      else if (payload.summary?.withinLegacyDupes > 0) setSection('dupes');
      else if (payload.summary?.exactInSystem > 0) setSection('exact');
      else setSection('legacyOnly');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to review roster');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [school]);

  useEffect(() => {
    if (school) void load();
  }, [school, load]);

  const summary = data?.summary;

  const exportSection = () => {
    if (!data || !school) return;
    const stamp = new Date().toISOString().slice(0, 10);
    const safeSchool = school.replace(/[^\w.-]+/g, '_');
    const headers = [
      'firstName', 'lastName', 'dob', 'externalId', 'issues', 'liveMatches', 'sourceTable',
    ];

    if (section === 'dupes') {
      const rows = data.withinLegacyDupes.flatMap((group) =>
        group.rows.map((r) => [
          r.firstName || '',
          r.lastName || '',
          r.dob || '',
          r.externalId || '',
          `Duplicate group (${group.rows.length} copies)`,
          '',
          '',
        ]),
      );
      downloadCsv(`legacy-review-${safeSchool}-mdb-dupes-${stamp}.csv`, headers, rows);
      return;
    }

    const rows =
      section === 'garbage' ? data.garbage
        : section === 'idConflicts' ? data.idConflicts
          : section === 'fuzzy' ? data.fuzzyMatches
            : section === 'exact' ? data.exactMatches
              : data.legacyOnlySample;

    downloadCsv(
      `legacy-review-${safeSchool}-${section}-${stamp}.csv`,
      headers,
      reviewRowsToCsv(rows),
    );
  };

  const sectionRowCount = (() => {
    if (!data) return 0;
    if (section === 'dupes') {
      return data.withinLegacyDupes.reduce((n, g) => n + g.rows.length, 0);
    }
    if (section === 'garbage') return data.garbage.length;
    if (section === 'idConflicts') return data.idConflicts.length;
    if (section === 'fuzzy') return data.fuzzyMatches.length;
    if (section === 'exact') return data.exactMatches.length;
    return data.legacyOnlySample.length;
  })();

  return (
    <div className="space-y-4">
      <Alert>
        <Database className="h-4 w-4" />
        <AlertDescription>
          Scans the school’s uploaded <strong>ASISTS / MDB legacy roster</strong> (from School Settings)
          against live students. Flags garbage rows (1-letter names, bad DOBs, placeholders) and
          possible duplicates already in the system. This does not change filing records — review only.
        </AlertDescription>
      </Alert>

      <div className="flex flex-wrap items-end gap-3">
        {role === 'Admin' ? (
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">School</label>
            <Select value={school} onValueChange={setSchool}>
              <SelectTrigger className="w-[260px]">
                <SelectValue placeholder="Select school" />
              </SelectTrigger>
              <SelectContent>
                {schools.map((name) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="text-sm">
            <span className="text-muted-foreground">School: </span>
            <span className="font-medium">{school || '—'}</span>
          </div>
        )}
        <Button variant="outline" className="gap-2" onClick={() => void load()} disabled={loading || !school}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Run review
        </Button>
        <Button
          variant="outline"
          className="gap-2"
          onClick={exportSection}
          disabled={!data || sectionRowCount === 0}
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/schools">Upload / replace MDB</Link>
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && !data && (
        <div className="flex items-center gap-2 py-12 justify-center text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Scanning legacy roster…
        </div>
      )}

      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Roster rows</CardDescription>
                <CardTitle className="text-2xl tabular-nums">{summary?.rosterCount ?? 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Garbage / low quality</CardDescription>
                <CardTitle className="text-2xl tabular-nums text-destructive">{summary?.garbage ?? 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Fuzzy / review vs live</CardDescription>
                <CardTitle className="text-2xl tabular-nums">{summary?.fuzzyInSystem ?? 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>ID conflicts</CardDescription>
                <CardTitle className="text-2xl tabular-nums">{summary?.idConflicts ?? 0}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          {data.meta && (
            <p className="text-xs text-muted-foreground">
              Source: <span className="font-medium">{data.meta.filename}</span>
              {data.meta.tableName ? ` · table ${data.meta.tableName}` : ''}
              {data.meta.uploadedAt
                ? ` · uploaded ${new Date(data.meta.uploadedAt).toLocaleString()}`
                : ''}
              {' · '}
              Live students in school: {summary?.liveCount ?? 0}
              {' · '}
              Exact already in system: {summary?.exactInSystem ?? 0}
              {' · '}
              Legacy-only: {summary?.legacyOnly ?? 0}
            </p>
          )}

          {data.message && (
            <Alert>
              <Search className="h-4 w-4" />
              <AlertDescription>{data.message}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap gap-2">
            {([
              ['garbage', `Garbage (${summary?.garbage ?? 0})`],
              ['idConflicts', `ID conflicts (${summary?.idConflicts ?? 0})`],
              ['fuzzy', `Fuzzy matches (${summary?.fuzzyInSystem ?? 0})`],
              ['exact', `Exact in system (${summary?.exactInSystem ?? 0})`],
              ['dupes', `Dupes in MDB (${summary?.withinLegacyDupes ?? 0})`],
              ['legacyOnly', `Legacy only (sample)`],
            ] as const).map(([key, label]) => (
              <Button
                key={key}
                size="sm"
                variant={section === key ? 'default' : 'outline'}
                onClick={() => setSection(key)}
              >
                {label}
              </Button>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {section === 'garbage' && 'Garbage / low-quality roster rows'}
                {section === 'idConflicts' && 'ASISTS ID matches a live student with a different name'}
                {section === 'fuzzy' && 'Possible duplicates already in this system'}
                {section === 'exact' && 'Already registered (exact name+DOB or same ASISTS ID)'}
                {section === 'dupes' && 'Duplicate rows inside the MDB roster'}
                {section === 'legacyOnly' && 'In MDB only (sample — not yet in this system)'}
              </CardTitle>
              <CardDescription>
                {section === 'garbage' && 'Fix or ignore in ASISTS before relying on these for intake matching.'}
                {section === 'idConflicts' && 'Same external ID, different name — verify which record is correct.'}
                {section === 'fuzzy' && 'Likely the same person already filed — use Intake or live Duplicate Review carefully.'}
                {section === 'exact' && 'These legacy rows already have a matching student record.'}
                {section === 'dupes' && 'Identical name+DOB(+ID) repeated in the import file.'}
                {section === 'legacyOnly' && 'Showing up to 50 rows with no live match.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {section === 'dupes' ? (
                data.withinLegacyDupes.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">No identical duplicates inside the roster.</p>
                ) : (
                  <div className="space-y-3">
                    {data.withinLegacyDupes.map((group) => (
                      <div key={group.key} className="rounded-md border px-3 py-2 text-sm">
                        <Badge variant="outline" className="mb-2">{group.rows.length} copies</Badge>
                        <ul className="space-y-1">
                          {group.rows.map((r) => (
                            <li key={r._id}>
                              {formatFullName(r)} · {r.dob || '—'}
                              {r.externalId ? ` · ${r.externalId}` : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <LegacyRowTable
                  rows={
                    section === 'garbage' ? data.garbage
                      : section === 'idConflicts' ? data.idConflicts
                        : section === 'fuzzy' ? data.fuzzyMatches
                          : section === 'exact' ? data.exactMatches
                            : data.legacyOnlySample
                  }
                  empty="Nothing in this bucket."
                  showMatches={section !== 'legacyOnly'}
                />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
