'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import AdminHeader from '@/components/AdminHeader';
import { AlertCircle, Building2, CheckCircle2, Edit2, Loader2, Plus, RefreshCw, Trash2, DatabaseZap, ArrowLeft } from 'lucide-react';
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
  intakeSessions?: string[];
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
    router.push(`/admin/schools/${schoolNameToSlug(school.name)}`);
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
      <div className="min-h-screen bg-background">
        <AdminHeader />
        <div className="w-full p-6 flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <div className="w-full p-6 space-y-6">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Button>

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Building2 className="h-8 w-8" />
              {isDataLead ? 'School Intake Settings' : 'School Configuration'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {isDataLead
                ? 'Configure intake session and activity options shown on your school\'s intake form.'
                : 'Manage the school and program names used in user, cabinet, and seed-data workflows.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={fetchSchools}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            {isAdmin && (
              <>
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
          </div>
        </div>

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
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Options</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats.total}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats.active}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Custom</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats.custom}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Fallback Defaults</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats.defaultCount}</div>
                </CardContent>
              </Card>
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
                ? 'Edit intake sessions and activities for your assigned school.'
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
                          {isDataLead && <span className="ml-2">Edit Intake Settings</span>}
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
      </div>
    </div>
  );
}
