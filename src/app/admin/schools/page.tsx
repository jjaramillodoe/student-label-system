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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getCurrentFiscalYear, getFiscalYearOptions } from '@/lib/fiscalYear';

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

const FISCAL_YEAR_OPTIONS = getFiscalYearOptions();

const EMPTY_FORM = {
  name: '',
  type: 'School',
  active: true,
  agencyId: '',
  currentFiscalYear: getCurrentFiscalYear(),
  intakeSessions: [] as string[],
  intakeActivities: [] as string[],
};

export default function SchoolsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [schools, setSchools] = useState<SchoolConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<SchoolConfig | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
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

  function openCreateDialog() {
    setEditingSchool(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEditDialog(school: SchoolConfig) {
    const base = {
      name: school.name,
      type: school.type || 'School',
      active: school.active,
      agencyId: school.agencyId || '',
      currentFiscalYear: school.currentFiscalYear || getCurrentFiscalYear(),
      intakeSessions: school.intakeSessions ?? [],
      intakeActivities: school.intakeActivities ?? [],
    };
    setEditingSchool(isDataLead || !school.isDefault ? school : null);
    setForm(base);
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/admin/schools', {
        method: isDataLead || editingSchool ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isDataLead
            ? {
                intakeSessions: form.intakeSessions,
                intakeActivities: form.intakeActivities,
                currentFiscalYear: form.currentFiscalYear,
              }
            : editingSchool
              ? { _id: editingSchool._id, ...form }
              : form,
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save school/program');

      setSuccess(
        isDataLead
          ? 'Intake settings saved.'
          : editingSchool
            ? 'School/program updated.'
            : 'School/program created.',
      );
      setDialogOpen(false);
      setEditingSchool(null);
      setForm(EMPTY_FORM);
      await fetchSchools();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save school/program.');
    } finally {
      setSaving(false);
    }
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
        {/* Back button */}
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Button>

        {/* Page header */}
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
                <Button onClick={openCreateDialog}>
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
                : 'Active options appear in school dropdowns. Inactive options stay saved but are hidden from new assignments unless already used.'}
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
                    <TableCell className="font-medium">{school.name}</TableCell>
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
                        <Button variant={isDataLead ? 'default' : 'ghost'} size="sm" onClick={() => openEditDialog(school)}>
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

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {isDataLead
                  ? 'Edit Intake Settings'
                  : editingSchool
                    ? 'Edit School/Program'
                    : 'Add School/Program'}
              </DialogTitle>
              <DialogDescription>
                {isDataLead
                  ? `Configure intake sessions and activities for ${form.name}.`
                  : editingSchool
                    ? 'Update how this option appears in dropdowns.'
                    : 'Create a school or program option for new assignments.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {isDataLead ? (
                <div className="rounded-md border bg-muted/40 px-3 py-2">
                  <p className="text-sm font-medium">{form.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    School name and other settings can only be changed by an administrator.
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="schoolName">Name</Label>
                    <Input
                      id="schoolName"
                      value={form.name}
                      onChange={(event) => setForm(current => ({ ...current, name: event.target.value }))}
                      placeholder="District 79, School 8, Program Name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="agencyId">
                      Agency ID
                      <span className="ml-1 text-xs text-muted-foreground font-normal">(used in student IDs, e.g. R01)</span>
                    </Label>
                    <Input
                      id="agencyId"
                      value={form.agencyId}
                      onChange={(event) => setForm(current => ({ ...current, agencyId: event.target.value.toUpperCase() }))}
                      placeholder="R01"
                      maxLength={8}
                      className="font-mono uppercase"
                    />
                    <p className="text-xs text-muted-foreground">
                      Leave blank to auto-derive from school name (School 1 → R01, School 2 → R02 …)
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={form.type} onValueChange={(value) => setForm(current => ({ ...current, type: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="District">District</SelectItem>
                        <SelectItem value="School">School</SelectItem>
                        <SelectItem value="Program">Program</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="active"
                      checked={form.active}
                      onCheckedChange={(checked) => setForm(current => ({ ...current, active: checked === true }))}
                    />
                    <Label htmlFor="active">Active in dropdowns</Label>
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label htmlFor="currentFiscalYear">
                  Current Fiscal Year
                  <span className="ml-1 text-xs text-muted-foreground font-normal">(used on the intake form)</span>
                </Label>
                <Select
                  value={form.currentFiscalYear}
                  onValueChange={(value) => setForm(current => ({ ...current, currentFiscalYear: value }))}
                >
                  <SelectTrigger id="currentFiscalYear">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FISCAL_YEAR_OPTIONS.map(year => (
                      <SelectItem key={year} value={year}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>
                  Intake Sessions
                  <span className="ml-1 text-xs text-muted-foreground font-normal">(one per line — shown on the intake form)</span>
                </Label>
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[120px] resize-y font-mono"
                  placeholder={"MORNING 8am-4pm\nEVENING 4pm-5pm\nSATURDAY"}
                  value={(form.intakeSessions ?? []).join('\n')}
                  onChange={(e) =>
                    setForm(current => ({
                      ...current,
                      intakeSessions: e.target.value.split('\n').map(s => s.trim()).filter(Boolean),
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank to use the system defaults (MORNING 8am-4pm, EVENING 4pm-5pm, SATURDAY, MS265, SSHS, BUSHWICK-EVENING, RIDGEWOOD).
                </p>
              </div>
              <div className="space-y-2">
                <Label>
                  Intake Activities
                  <span className="ml-1 text-xs text-muted-foreground font-normal">(one per line — checkbox options on the intake form)</span>
                </Label>
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[120px] resize-y font-mono"
                  placeholder={"Intake Paperwork Only\nOrientation\nTesting\nLocator\nPlacement\nAdditional Classes\nTransfer"}
                  value={(form.intakeActivities ?? []).join('\n')}
                  onChange={(e) =>
                    setForm(current => ({
                      ...current,
                      intakeActivities: e.target.value.split('\n').map(s => s.trim()).filter(Boolean),
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank to use the system defaults (Intake Paperwork Only, Orientation, Testing, Locator, Placement, Additional Classes, Transfer).
                </p>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
