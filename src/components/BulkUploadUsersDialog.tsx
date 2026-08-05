'use client';

import { useMemo, useState } from 'react';
import {
  AlertCircle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

type PreviewRow = {
  name: string;
  email: string;
  role: string;
  school: string;
  password: string;
  intakeSessions: string;
  issues: string[];
};

type UploadResult = {
  created: Array<{
    name: string;
    email: string;
    role: string;
    school: string;
    temporaryPassword: string;
    passwordGenerated: boolean;
  }>;
  skipped: Array<{ row: number; email: string; reason: string }>;
  errors: Array<{ row: number; email: string; reason: string }>;
  summary: { created: number; skipped: number; errors: number };
};

const VALID_ROLES = new Set(['Admin', 'Data Lead', 'Data Member', 'Intake Member']);

function normalizeRole(raw: string): string {
  const t = raw.trim();
  const lower = t.toLowerCase();
  if (lower === 'admin') return 'Admin';
  if (lower === 'data lead' || lower === 'datalead') return 'Data Lead';
  if (lower === 'data member' || lower === 'datamember') return 'Data Member';
  if (lower === 'intake member' || lower === 'intakemember') return 'Intake Member';
  return t;
}

/** Minimal CSV parser for quoted fields and commas. */
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const parseLine = (line: string): string[] => {
    const cells: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        cells.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    cells.push(cur.trim());
    return cells;
  };

  const headers = parseLine(lines[0]).map((h) => h.trim().toLowerCase());
  const alias: Record<string, string> = {
    name: 'name',
    email: 'email',
    role: 'role',
    school: 'school',
    password: 'password',
    intakesessions: 'intakeSessions',
    allowedintakesessions: 'intakeSessions',
    sessions: 'intakeSessions',
  };

  return lines.slice(1).map((line) => {
    const cells = parseLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      const key = alias[h.replace(/\s+/g, '')] || alias[h] || h;
      row[key] = cells[i] ?? '';
    });
    return row;
  });
}

function buildPreview(rows: Record<string, string>[]): PreviewRow[] {
  const seen = new Set<string>();
  return rows.map((r) => {
    const name = (r.name || '').trim();
    const email = (r.email || '').toLowerCase().trim();
    const role = normalizeRole(r.role || '');
    const school = (r.school || '').trim();
    const password = (r.password || '').trim();
    const intakeSessions = (r.intakeSessions || '').trim();
    const issues: string[] = [];

    if (!name) issues.push('Missing name');
    if (!email) issues.push('Missing email');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) issues.push('Invalid email');
    if (!role) issues.push('Missing role');
    else if (!VALID_ROLES.has(role)) issues.push(`Invalid role "${role}"`);
    if (!school) issues.push('Missing school');
    if (email && seen.has(email)) issues.push('Duplicate in file');
    if (email) seen.add(email);

    return { name, email, role, school, password, intakeSessions, issues };
  });
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
};

export default function BulkUploadUsersDialog({ open, onOpenChange, onDone }: Props) {
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<UploadResult | null>(null);

  const readyRows = useMemo(
    () => preview.filter((r) => r.issues.length === 0),
    [preview],
  );
  const issueCount = preview.length - readyRows.length;

  function reset() {
    setFileName('');
    setPreview([]);
    setUploading(false);
    setError('');
    setResult(null);
  }

  function handleClose(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function onFile(file: File | null) {
    if (!file) return;
    setError('');
    setResult(null);
    setFileName(file.name);
    const text = await file.text();
    const rows = parseCsv(text);
    if (!rows.length) {
      setPreview([]);
      setError('No data rows found. Check the CSV headers: name, email, role, school.');
      return;
    }
    setPreview(buildPreview(rows));
  }

  async function upload() {
    if (!readyRows.length || uploading) return;
    setUploading(true);
    setError('');
    try {
      const res = await fetch('/api/users/bulk-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          users: readyRows.map((r) => ({
            name: r.name,
            email: r.email,
            role: r.role,
            school: r.school,
            password: r.password || undefined,
            intakeSessions: r.intakeSessions || undefined,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setResult(data as UploadResult);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function downloadCredentials() {
    if (!result?.created.length) return;
    const header = 'name,email,role,school,temporaryPassword,mustChangePassword';
    const lines = result.created.map((u) =>
      [
        csvEscape(u.name),
        csvEscape(u.email),
        csvEscape(u.role),
        csvEscape(u.school),
        csvEscape(u.temporaryPassword),
        'yes',
      ].join(','),
    );
    downloadText(
      `user-credentials-${new Date().toISOString().slice(0, 10)}.csv`,
      [header, ...lines].join('\n'),
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" /> Bulk Upload Users
          </DialogTitle>
          <DialogDescription>
            Upload a CSV to create many accounts at once. Leave password blank to auto-generate
            temporary passwords (users must change them on first sign-in).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href="/user_bulk_upload_template.csv" download>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Download template
              </a>
            </Button>
          </div>

          <div className="rounded-lg border border-dashed px-4 py-6 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Columns: <code className="text-xs">name, email, role, school, password, intakeSessions</code>
            </p>
            <p className="text-xs text-muted-foreground">
              Roles: Admin, Data Lead, Data Member, Intake Member. For Intake Members, leave
              intakeSessions blank to allow all sessions at that school, or list them with
              semicolons (e.g. MORNING;EVENING).
            </p>
            <InputFile onFile={onFile} fileName={fileName} />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {result && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Upload complete</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>
                  Created {result.summary.created}
                  {result.summary.skipped ? ` · skipped ${result.summary.skipped}` : ''}
                  {result.summary.errors ? ` · errors ${result.summary.errors}` : ''}.
                </p>
                {result.created.length > 0 && (
                  <Button size="sm" variant="outline" className="gap-2" onClick={downloadCredentials}>
                    <Download className="h-4 w-4" />
                    Download temporary passwords
                  </Button>
                )}
                {(result.skipped.length > 0 || result.errors.length > 0) && (
                  <ul className="text-xs mt-2 space-y-1 max-h-32 overflow-y-auto">
                    {[...result.errors, ...result.skipped].map((item, i) => (
                      <li key={`${item.email}-${i}`}>
                        Row {item.row}: {item.email} — {item.reason}
                      </li>
                    ))}
                  </ul>
                )}
              </AlertDescription>
            </Alert>
          )}

          {preview.length > 0 && !result && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="secondary">{preview.length} rows</Badge>
                <Badge variant={readyRows.length ? 'default' : 'outline'}>
                  {readyRows.length} ready
                </Badge>
                {issueCount > 0 && (
                  <Badge variant="destructive">{issueCount} with issues</Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  Blank passwords → auto-generated temps
                </span>
              </div>
              <div className="rounded-md border overflow-x-auto max-h-72">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>School</TableHead>
                      <TableHead>Password</TableHead>
                      <TableHead>Issues</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((r, i) => (
                      <TableRow key={`${r.email}-${i}`} className={r.issues.length ? 'bg-destructive/5' : undefined}>
                        <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="text-sm font-medium">{r.name || '—'}</TableCell>
                        <TableCell className="text-xs font-mono">{r.email || '—'}</TableCell>
                        <TableCell className="text-sm">{r.role || '—'}</TableCell>
                        <TableCell className="text-sm">{r.school || '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {r.password ? 'Provided' : 'Auto'}
                        </TableCell>
                        <TableCell className="text-xs text-destructive">
                          {r.issues.join('; ') || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => handleClose(false)}>
            {result ? 'Close' : 'Cancel'}
          </Button>
          {!result && (
            <Button
              onClick={upload}
              disabled={!readyRows.length || uploading}
              className="gap-2"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Create {readyRows.length || ''} user{readyRows.length === 1 ? '' : 's'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function InputFile({
  onFile,
  fileName,
}: {
  onFile: (file: File | null) => void;
  fileName: string;
}) {
  return (
    <label className="inline-flex cursor-pointer">
      <input
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] || null)}
      />
      <span className="inline-flex items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-muted">
        <Upload className="h-4 w-4" />
        {fileName || 'Choose CSV file'}
      </span>
    </label>
  );
}
