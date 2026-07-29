'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import AdminHeader from '@/components/AdminHeader';
import SchoolConfigForm, { type SchoolFormState } from '@/components/SchoolConfigForm';
import { AlertCircle, ArrowLeft, Building2, CheckCircle2, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getCurrentFiscalYear } from '@/lib/fiscalYear';
import { leadershipToFormFields } from '@/lib/schoolLeadership';
import { schoolNameToSlug } from '@/lib/schoolSlug';
import { normalizeIntakeSessions } from '@/lib/intakeSession';

type SchoolConfig = {
  _id: string;
  name: string;
  type: string;
  active: boolean;
  agencyId?: string;
  intakeSessions?: unknown;
  intakeActivities?: string[];
  currentFiscalYear?: string;
  principal?: { name: string; email?: string; phone?: string } | null;
  assistantPrincipals?: { name: string; email?: string; phone?: string }[];
  isDefault?: boolean;
};

function schoolToForm(school: SchoolConfig): SchoolFormState {
  return {
    name: school.name,
    type: school.type || 'School',
    active: school.active,
    agencyId: school.agencyId || '',
    currentFiscalYear: school.currentFiscalYear || getCurrentFiscalYear(),
    intakeSessions: normalizeIntakeSessions(school.intakeSessions ?? []),
    intakeActivities: school.intakeActivities ?? [],
    ...leadershipToFormFields(school),
  };
}

export default function EditSchoolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [slug, setSlug] = useState<string | null>(null);
  const [school, setSchool] = useState<SchoolConfig | null>(null);
  const [form, setForm] = useState<SchoolFormState>({
    name: '',
    type: 'School',
    active: true,
    agencyId: '',
    currentFiscalYear: getCurrentFiscalYear(),
    intakeSessions: [],
    intakeActivities: [],
    ...leadershipToFormFields({}),
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const userRole = (session?.user as { role?: string })?.role;
  const isAdmin = userRole === 'Admin';
  const isDataLead = userRole === 'Data Lead';
  const canManageSchools = isAdmin || isDataLead;

  useEffect(() => {
    params.then(({ slug: routeSlug }) => setSlug(routeSlug));
  }, [params]);

  useEffect(() => {
    if (status === 'loading' || !slug) return;

    if (!session) {
      router.push('/auth/signin');
      return;
    }

    if (!canManageSchools) {
      router.push('/');
      return;
    }

    async function loadSchool() {
      setLoading(true);
      setError('');

      const routeSlug = slug;
      if (!routeSlug) return;

      try {
        const res = await fetch(`/api/admin/schools/${encodeURIComponent(routeSlug)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load school/program');

        setSchool(data);
        setForm(schoolToForm(data));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load school/program.');
      } finally {
        setLoading(false);
      }
    }

    loadSchool();
  }, [session, status, slug, router, canManageSchools]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!school) return;

    setSaving(true);
    setError('');
    setSuccess('');

    const persisted = isDataLead || !school.isDefault ? school : null;

    try {
      const res = await fetch('/api/admin/schools', {
        method: isDataLead || persisted ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isDataLead
            ? {
                intakeSessions: form.intakeSessions,
                intakeActivities: form.intakeActivities,
                currentFiscalYear: form.currentFiscalYear,
                principal: form.principal,
                assistantPrincipals: form.assistantPrincipals,
              }
            : persisted
              ? { _id: persisted._id, ...form }
              : form,
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save school/program');

      setSuccess(
        isDataLead
          ? 'School settings saved.'
          : persisted
            ? 'School/program updated.'
            : 'School/program saved as a custom entry.',
      );

      const updated = data as SchoolConfig;
      setSchool(updated);
      setForm(schoolToForm(updated));

      if (!persisted && !isDataLead && updated.name) {
        const newSlug = schoolNameToSlug(updated.name);
        if (newSlug !== slug) {
          router.replace(`/admin/schools/${newSlug}`);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save school/program.');
    } finally {
      setSaving(false);
    }
  }

  if (status === 'loading' || loading || !school) {
    return (
      <div className="min-h-screen bg-background">
        <AdminHeader />
        <div className="w-full p-6 flex items-center justify-center min-h-[50vh]">
          {error ? (
            <div className="max-w-md space-y-4 text-center">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
              <Button variant="outline" onClick={() => router.push('/admin/schools')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to schools
              </Button>
            </div>
          ) : (
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <div className="w-full max-w-4xl mx-auto p-6 space-y-6">
        <Button variant="outline" onClick={() => router.push('/admin/schools')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to schools
        </Button>

        <div className="space-y-1">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building2 className="h-8 w-8" />
            {isDataLead ? 'Edit School Settings' : 'Edit School/Program'}
          </h1>
          <p className="text-muted-foreground">
            {isDataLead
              ? `Configure leadership contacts and intake options for ${school.name}.`
              : 'Update school details, leadership, and intake form options.'}
          </p>
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

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{school.name}</CardTitle>
              {isAdmin && (
                <>
                  <Badge variant={school.active ? 'default' : 'secondary'}>
                    {school.active ? 'Active' : 'Inactive'}
                  </Badge>
                  <Badge variant="outline">
                    {school.isDefault ? 'Fallback default' : 'Custom'}
                  </Badge>
                  {school.agencyId && (
                    <Badge variant="outline" className="font-mono">
                      {school.agencyId}
                    </Badge>
                  )}
                </>
              )}
            </div>
            {isAdmin && school.isDefault && (
              <CardDescription>
                This is a fallback default. Saving will create a custom entry you can manage
                permanently.
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <SchoolConfigForm
              form={form}
              setForm={setForm}
              onSubmit={handleSubmit}
              saving={saving}
              isDataLead={isDataLead}
              mode="edit"
              onCancel={() => router.push('/admin/schools')}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
