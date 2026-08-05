'use client';

import { useState } from 'react';
import {
  AlertCircle, CheckCircle2, FileSpreadsheet, Loader2, Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { parsePrincipalsCsv, type PrincipalsCsvSchoolRow } from '@/lib/principalsCsv';

type ImportResult = {
  templateSchool: string;
  copyIntake: boolean;
  intakeSessionsCopied: number;
  intakeActivitiesCopied: number;
  updated: string[];
  created: string[];
  errors: Array<{ school: string; reason: string }>;
  summary: { updated: number; created: number; errors: number };
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
  templateSchool?: string;
};

export default function ImportPrincipalsDialog({
  open,
  onOpenChange,
  onDone,
  templateSchool = 'School 8',
}: Props) {
  const [fileName, setFileName] = useState('');
  const [csv, setCsv] = useState('');
  const [preview, setPreview] = useState<PrincipalsCsvSchoolRow[]>([]);
  const [copyIntake, setCopyIntake] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);

  function reset() {
    setFileName('');
    setCsv('');
    setPreview([]);
    setCopyIntake(true);
    setLoading(false);
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
    setCsv(text);
    const rows = parsePrincipalsCsv(text);
    setPreview(rows);
    if (!rows.length) {
      setError('No school rows found. Expected a School column like "School 1" … "School 8".');
    }
  }

  async function runImport() {
    if (!csv || !preview.length || loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/schools/import-principals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csv,
          templateSchool,
          copyIntake,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      setResult(data as ImportResult);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" /> Import principals CSV
          </DialogTitle>
          <DialogDescription>
            Updates principal and assistant principal contacts for each school in the file.
            Optionally copies intake sessions and activities from {templateSchool}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-dashed px-4 py-6 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Expected columns: School, Principal Name, Email Address, AP Name 1, AP Email1, AP Name2, AP Email2
            </p>
            <label className="inline-flex cursor-pointer">
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => void onFile(e.target.files?.[0] || null)}
              />
              <span className="inline-flex items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-muted">
                <Upload className="h-4 w-4" />
                {fileName || 'Choose principals.csv'}
              </span>
            </label>
          </div>

          <div className="flex items-start gap-3 rounded-lg border px-3 py-3">
            <Checkbox
              id="copy-intake"
              checked={copyIntake}
              onCheckedChange={(v) => setCopyIntake(v === true)}
            />
            <div className="space-y-1">
              <Label htmlFor="copy-intake" className="cursor-pointer">
                Copy intake sessions &amp; activities from {templateSchool}
              </Label>
              <p className="text-xs text-muted-foreground">
                Applies {templateSchool}&apos;s saved intake session windows and activity list to every
                school in the CSV (creates the school config if it only exists as a default).
              </p>
            </div>
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
              <AlertTitle>Import complete</AlertTitle>
              <AlertDescription className="space-y-1 text-sm">
                <p>
                  Updated {result.summary.updated}
                  {result.summary.created ? ` · created ${result.summary.created}` : ''}
                  {result.summary.errors ? ` · errors ${result.summary.errors}` : ''}.
                </p>
                {result.copyIntake && (
                  <p className="text-xs text-muted-foreground">
                    Copied {result.intakeSessionsCopied} intake session(s) and{' '}
                    {result.intakeActivitiesCopied} activit{result.intakeActivitiesCopied === 1 ? 'y' : 'ies'} from{' '}
                    {result.templateSchool}.
                  </p>
                )}
                {result.errors.length > 0 && (
                  <ul className="text-xs mt-2 space-y-1">
                    {result.errors.map((e) => (
                      <li key={e.school}>{e.school}: {e.reason}</li>
                    ))}
                  </ul>
                )}
              </AlertDescription>
            </Alert>
          )}

          {preview.length > 0 && !result && (
            <div className="rounded-md border overflow-x-auto max-h-72">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>School</TableHead>
                    <TableHead>Principal</TableHead>
                    <TableHead>AP 1</TableHead>
                    <TableHead>AP 2</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((row) => (
                    <TableRow key={row.school}>
                      <TableCell className="font-medium">{row.school}</TableCell>
                      <TableCell className="text-sm">
                        {row.principal?.name || '—'}
                        {row.principal?.email && (
                          <div className="text-[11px] text-muted-foreground font-mono">
                            {row.principal.email}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.assistantPrincipals[0]?.name || '—'}
                        {row.assistantPrincipals[0]?.email && (
                          <div className="text-[11px] text-muted-foreground font-mono">
                            {row.assistantPrincipals[0].email}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.assistantPrincipals[1]?.name || '—'}
                        {row.assistantPrincipals[1]?.email && (
                          <div className="text-[11px] text-muted-foreground font-mono">
                            {row.assistantPrincipals[1].email}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => handleClose(false)}>
            {result ? 'Close' : 'Cancel'}
          </Button>
          {!result && (
            <Button
              onClick={() => void runImport()}
              disabled={!preview.length || loading}
              className="gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Import {preview.length || ''} school{preview.length === 1 ? '' : 's'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
