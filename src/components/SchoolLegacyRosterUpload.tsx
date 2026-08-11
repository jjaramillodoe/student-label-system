'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle, CheckCircle2, Database, Loader2, Search, Trash2, Upload,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { parseLegacyCsv, parseMdbBuffer, type LegacyRosterRow } from '@/lib/legacyRoster';
import { detectLegacyGarbage } from '@/lib/legacyRosterReview';

type RosterMeta = {
  uploadedAt?: string;
  filename?: string;
  rowCount?: number;
  tableName?: string;
  sourceType?: 'mdb' | 'csv';
  uploadedBy?: { name?: string; email?: string };
};

const BATCH_SIZE = 2000;

async function readApiJson(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    const snippet = text.replace(/\s+/g, ' ').slice(0, 120);
    if (/request entity too large/i.test(text) || res.status === 413) {
      throw new Error(
        'Upload rejected: file too large for the server. The app now parses .mdb in your browser — refresh and try again, or use a CSV export.',
      );
    }
    throw new Error(
      res.ok
        ? `Unexpected server response: ${snippet}`
        : `Upload failed (${res.status}): ${snippet || res.statusText}`,
    );
  }
}

export default function SchoolLegacyRosterUpload({ schoolName }: { schoolName: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [meta, setMeta] = useState<RosterMeta | null>(null);
  const [rowCount, setRowCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadStatus = useCallback(async () => {
    if (!schoolName) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `/api/admin/schools/legacy-roster?school=${encodeURIComponent(schoolName)}`,
      );
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error || 'Failed to load roster status');
      setMeta(data.meta);
      setRowCount(data.rowCount || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load roster status');
    } finally {
      setLoading(false);
    }
  }, [schoolName]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  async function uploadParsedRows(opts: {
    rows: LegacyRosterRow[];
    filename: string;
    sourceType: 'mdb' | 'csv';
    tableName?: string;
  }) {
    const { rows, filename, sourceType, tableName } = opts;
    if (!rows.length) throw new Error('No student rows found in the file.');

    // Clear + first batch (or all if small)
    const first = rows.slice(0, BATCH_SIZE);
    const rest = rows.slice(BATCH_SIZE);
    setProgress(`Uploading 1–${first.length} of ${rows.length}…`);

    const firstRes = await fetch('/api/admin/schools/legacy-roster', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'replace',
        school: schoolName,
        filename,
        sourceType,
        tableName,
        rows: first.map(({ firstName, lastName, dob, externalId }) => ({
          firstName, lastName, dob, externalId,
        })),
        finalize: rest.length === 0,
      }),
    });
    const firstData = await readApiJson(firstRes);
    if (!firstRes.ok) throw new Error(firstData.error || 'Upload failed');

    let uploaded = first.length;
    for (let i = 0; i < rest.length; i += BATCH_SIZE) {
      const batch = rest.slice(i, i + BATCH_SIZE);
      const isLast = i + BATCH_SIZE >= rest.length;
      setProgress(`Uploading ${uploaded + 1}–${uploaded + batch.length} of ${rows.length}…`);
      const res = await fetch('/api/admin/schools/legacy-roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'append',
          school: schoolName,
          filename,
          sourceType,
          tableName,
          rows: batch.map(({ firstName, lastName, dob, externalId }) => ({
            firstName, lastName, dob, externalId,
          })),
          finalize: isLast,
        }),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      uploaded += batch.length;
      if (isLast && data.meta) {
        setMeta(data.meta);
        setRowCount(data.rowCount || data.meta.rowCount || uploaded);
      } else if (data.rowCount != null) {
        setRowCount(data.rowCount);
      }
    }

    if (rest.length === 0) {
      setMeta(firstData.meta);
      setRowCount(firstData.rowCount || firstData.meta?.rowCount || uploaded);
    }

    return { tableName, count: rows.length };
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploading(true);
    setError('');
    setSuccess('');
    setProgress('Reading file…');

    try {
      const filename = file.name || 'roster';
      const lower = filename.toLowerCase();

      let parsed;
      if (lower.endsWith('.mdb') || lower.endsWith('.accdb')) {
        setProgress('Parsing Access database in your browser…');
        const buffer = await file.arrayBuffer();
        parsed = parseMdbBuffer(buffer, schoolName, filename);
      } else if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
        setProgress('Parsing CSV…');
        const text = await file.text();
        parsed = parseLegacyCsv(text, schoolName, filename);
      } else {
        throw new Error('Unsupported file type. Upload .mdb, .accdb, or .csv');
      }

      const result = await uploadParsedRows({
        rows: parsed.rows,
        filename,
        sourceType: lower.endsWith('.csv') || lower.endsWith('.txt') ? 'csv' : 'mdb',
        tableName: parsed.tableName,
      });

      let garbageErrors = 0;
      let garbageWarnings = 0;
      for (const row of parsed.rows) {
        const flags = detectLegacyGarbage(row);
        if (flags.some((f) => f.severity === 'error')) garbageErrors += 1;
        else if (flags.some((f) => f.severity === 'warning')) garbageWarnings += 1;
      }

      setProgress('');
      setSuccess(
        `Imported ${result.count.toLocaleString()} students`
        + (result.tableName ? ` from table “${result.tableName}”` : '')
        + '. Intake will check this roster for NEW registrations.'
        + (garbageErrors || garbageWarnings
          ? ` Quality scan: ${garbageErrors.toLocaleString()} error-level row(s)`
            + (garbageWarnings ? `, ${garbageWarnings.toLocaleString()} warning(s)` : '')
            + ' — open Legacy MDB import review.'
          : ' Quality scan: no obvious garbage rows.'),
      );
    } catch (err) {
      setProgress('');
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function clearRoster() {
    if (!confirm(`Remove the ASISTS / legacy roster for ${schoolName}?`)) return;
    setClearing(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(
        `/api/admin/schools/legacy-roster?school=${encodeURIComponent(schoolName)}`,
        { method: 'DELETE' },
      );
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error || 'Failed to clear roster');
      setMeta(null);
      setRowCount(0);
      setSuccess('Legacy roster cleared.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear roster');
    } finally {
      setClearing(false);
    }
  }

  return (
    <Card className="border-violet-200 dark:border-violet-900">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Database className="h-4 w-4 text-violet-700 dark:text-violet-300" />
          ASISTS / legacy student roster
        </CardTitle>
        <CardDescription>
          Upload the school Access database (<code className="text-xs">.mdb</code> / <code className="text-xs">.accdb</code>)
          or a CSV export with First Name, Last Name, and DOB. The file is parsed in your browser so large MDBs work;
          only student rows are saved. Admins and Data Leads can manage this roster.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading roster status…
          </div>
        ) : meta ? (
          <div className="rounded-lg border bg-muted/30 px-3 py-3 space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono text-[10px] uppercase">
                {meta.sourceType || 'file'}
              </Badge>
              <span className="font-medium truncate max-w-[240px]" title={meta.filename}>
                {meta.filename}
              </span>
              <Badge>{rowCount.toLocaleString()} students</Badge>
              {meta.tableName && (
                <Badge variant="secondary">Table: {meta.tableName}</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Uploaded {meta.uploadedAt ? new Date(meta.uploadedAt).toLocaleString() : '—'}
              {meta.uploadedBy?.name ? ` by ${meta.uploadedBy.name}` : ''}
            </p>
          </div>
        ) : (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="text-sm">No roster uploaded</AlertTitle>
            <AlertDescription className="text-xs">
              Until you upload a file, intake can only check students already in this system (including archived).
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 dark:text-green-200">{success}</AlertDescription>
          </Alert>
        )}
        {uploading && progress && (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {progress}
          </p>
        )}

        <div className="space-y-2">
          <Label htmlFor="legacy-roster-file">Upload .mdb / .accdb / .csv</Label>
          <Input
            ref={inputRef}
            id="legacy-roster-file"
            type="file"
            accept=".mdb,.accdb,.csv,.txt,application/vnd.ms-access,text/csv"
            disabled={uploading || clearing}
            onChange={onFileChange}
          />
          <p className="text-xs text-muted-foreground">
            Large Access files are OK — parsing happens locally. Re-uploading replaces the previous roster.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="gap-2"
            disabled={uploading || clearing}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? 'Importing…' : meta ? 'Replace roster' : 'Upload roster'}
          </Button>
          {meta && rowCount > 0 && (
            <Button type="button" variant="outline" className="gap-2" asChild>
              <Link
                href={`/admin/duplicates?tab=legacy&school=${encodeURIComponent(schoolName)}`}
              >
                <Search className="h-4 w-4" />
                Review import quality
              </Link>
            </Button>
          )}
          {meta && (
            <Button
              type="button"
              variant="outline"
              className="gap-2 text-destructive"
              disabled={uploading || clearing}
              onClick={clearRoster}
            >
              {clearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Clear roster
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
