'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle, CheckCircle2, Database, Loader2, Trash2, Upload,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type RosterMeta = {
  uploadedAt?: string;
  filename?: string;
  rowCount?: number;
  tableName?: string;
  sourceType?: 'mdb' | 'csv';
  uploadedBy?: { name?: string; email?: string };
};

export default function SchoolLegacyRosterUpload({ schoolName }: { schoolName: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [meta, setMeta] = useState<RosterMeta | null>(null);
  const [rowCount, setRowCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
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
      const data = await res.json();
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

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploading(true);
    setError('');
    setSuccess('');
    try {
      const body = new FormData();
      body.set('file', file);
      body.set('school', schoolName);
      const res = await fetch('/api/admin/schools/legacy-roster', {
        method: 'POST',
        body,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setMeta(data.meta);
      setRowCount(data.meta?.rowCount || 0);
      setSuccess(
        `Imported ${data.meta?.rowCount ?? 0} students`
        + (data.tableName ? ` from table “${data.tableName}”` : '')
        + '. Intake will check this roster for NEW registrations.',
      );
    } catch (err) {
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
      const data = await res.json();
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
          or a CSV export with First Name, Last Name, and DOB. Intake uses this as a first check
          (like ASISTS) before registering a NEW student. Rows are stored for lookup only — they do not create live files or labels.
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
            Max 12 MB. Re-uploading replaces the previous roster for this school.
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
