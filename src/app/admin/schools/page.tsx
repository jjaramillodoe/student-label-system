'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Building2, CheckCircle2, Edit2, Loader2, Plus, RefreshCw, Trash2, DatabaseZap, FileSpreadsheet } from 'lucide-react';
import PageIntro from '@/components/PageIntro';
import ImportPrincipalsDialog from '@/components/ImportPrincipalsDialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { schoolNameToSlug } from '@/lib/schoolSlug';

type SchoolConfig = {
  _id: string;
  name: string;
  type: string;
  active: boolean;
  agencyId?: string;
  slug?: string;
  intakeSessions?: unknown;
  intakeActivities?: string[];
  currentFiscalYear?: string;
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export default function SchoolsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [schools, setSchools] = useState<SchoolConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [migrating, setMigrating] = useState(false);
  const [migrateResult, setMigrateResult] = useState<{ updated: number; skipped?: number; message: string } | null>(null);
  const [importPrincipalsOpen, setImportPrincipalsOpen] = useState(false);

  const userRole = (session?.user as { role?: string })?.role;
  const isAdmin = userRole === 'Admin';
  const isDataLead = userRole === 'Data Lead';
  const canManageSchools = isAdmin || isDataLead;

  useEffect(() => {
    if (status === 'loading') return;

    if (!session) {
      router.push('/auth/signin');
      return;
    }

    if (!canManageSchools) {
      router.push('/');
      return;
    }

    fetchSchools();
  }, [session, status, router, canManageSchools]);

  async function fetchSchools() {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/schools');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch schools');
      setSchools(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schools/programs.');
    } finally {
      setLoading(false);
    }
  }

  function openCreatePage() {
    router.push('/admin/schools/new');
  }

  function openEditPage(school: SchoolConfig) {
    router.push(`/admin/schools/${school.slug || schoolNameToSlug(school.name)}`);
  }

  async function handleDelete(school: SchoolConfig) {
    if (school.isDefault) {
      setError('Default fallback schools cannot be deleted. Save a custom entry with the same name to manage it.');
      return;
    }

    if (!confirm(`Delete ${school.name}? Existing users, students, and cabinets will keep their current school value.`)) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/admin/schools?id=${school._id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete school/program');

      setSuccess('School/program deleted.');
      await fetchSchools();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete school/program.');
    } finally {
      setSaving(false);
    }
  }

  async function handleMigrateStudentIds() {
    if (!confirm(
      'This will backfill labelId and generate the new demographic studentId for every student record that does not have one yet.\n\nSafe to run multiple times — only touches unmigrated records.\n\nProceed?'
    )) return;

    setMigrating(true);
    setMigrateResult(null);
    setError('');

    try {
      const res = await fetch('/api/admin/migrate-student-ids', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Migration failed');
      setMigrateResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Migration failed.');
    } finally {
      setMigrating(false);
    }
  }

  const stats = useMemo(() => ({
    total: schools.length,
    active: schools.filter(school => school.active).length,
    custom: schools.filter(school => !school.isDefault).length,
    defaultCount: schools.filter(school => school.isDefault).length,
  }), [schools]);

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
          title="School Settings"
          description={
            isDataLead
              ? 'Configure intake session and activity options shown on your school\'s intake form.'
              : 'Manage the school and program names used in user, cabinet, and seed-data workflows.'
          }
          icon={<Building2 className="h-5 w-5 text-primary" />}
          actions={
            <>
              <Button variant="outline" onClick={fetchSchools}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
              {isAdmin && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setImportPrincipalsOpen(true)}
                    title="Import principal/AP CSV and optionally copy School 8 intake settings"
                  >
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Import Principals
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleMigrateStudentIds}
                    disabled={migrating}
                    title="Backfill labelId and new demographic studentId for existing records"
                  >
                    {migrating
                      ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Migrating…</>
                      : <><DatabaseZap className="mr-2 h-4 w-4" /> Backfill Student IDs</>}
                  </Button>
                  <Button onClick={openCreatePage}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add School/Program
                  </Button>
                </>
              )}
            </>
          }
        />

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {migrateResult && (
          <Alert className="border-green-300 bg-green-50 dark:bg-green-950/20 dark:border-green-800">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 dark:text-green-300">
              <span className="font-semibold">{migrateResult.message}</span>
              {migrateResult.updated > 0 && (
                <span className="ml-2 text-sm">
                  ({migrateResult.updated} records updated
                  {migrateResult.skipped ? `, ${migrateResult.skipped} skipped` : ''})
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {isAdmin && (
          <>
            <div className="flex flex-wrap gap-x-8 gap-y-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total options</p>
                <p className="text-xl font-semibold tabular-nums tracking-tight">{stats.total}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Active</p>
                <p className="text-xl font-semibold tabular-nums tracking-tight">{stats.active}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Custom</p>
                <p className="text-xl font-semibold tabular-nums tracking-tight">{stats.custom}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Fallback defaults</p>
                <p className="text-xl font-semibold tabular-nums tracking-tight">{stats.defaultCount}</p>
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Fallback defaults are shown until you save a custom entry with the same name. Existing records keep their school value even if an option is renamed or deleted.
              </AlertDescription>
            </Alert>
          </>
        )}

        {isDataLead && schools.length === 0 && !loading && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No school is assigned to your account. Contact an administrator to set your school before configuring intake settings.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{isDataLead ? 'Your School' : 'Allowed Schools And Programs'}</CardTitle>
            <CardDescription>
              {isDataLead
                ? 'Edit principal, assistant principals, and intake settings for your assigned school.'
                : 'Active options appear in school dropdowns. Click a school name or edit to open its settings page.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  {isAdmin && (
                    <>
                      <TableHead>Subdomain</TableHead>
                      <TableHead>Agency ID</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Source</TableHead>
                    </>
                  )}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schools.map(school => (
                  <TableRow key={school._id}>
                    <TableCell className="font-medium">
                      <button
                        type="button"
                        onClick={() => openEditPage(school)}
                        className="text-left hover:underline focus:outline-none focus:underline"
                      >
                        {school.name}
                      </button>
                    </TableCell>
                    {isAdmin && (
                      <>
                        <TableCell>
                          <span className="font-mono text-xs text-muted-foreground">
                            {school.slug || schoolNameToSlug(school.name)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {school.agencyId
                            ? <span className="font-mono text-sm bg-muted px-1.5 py-0.5 rounded">{school.agencyId}</span>
                            : <span className="text-muted-foreground text-xs">—</span>}
                        </TableCell>
                        <TableCell>{school.type || 'School'}</TableCell>
                        <TableCell>
                          <Badge variant={school.active ? 'default' : 'secondary'}>
                            {school.active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{school.isDefault ? 'Fallback default' : 'Custom'}</Badge>
                        </TableCell>
                      </>
                    )}
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant={isDataLead ? 'default' : 'ghost'} size="sm" onClick={() => openEditPage(school)}>
                          <Edit2 className="h-4 w-4" />
                          {isDataLead && <span className="ml-2">Edit settings</span>}
                        </Button>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(school)}
                            disabled={school.isDefault || saving}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <ImportPrincipalsDialog
          open={importPrincipalsOpen}
          onOpenChange={setImportPrincipalsOpen}
          templateSchool="School 8"
          onDone={() => {
            void fetchSchools();
            setSuccess('Principals import finished. Schools refreshed.');
          }}
        />
    </div>
  );
}
