'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import AdminHeader from '@/components/AdminHeader';
import SchoolConfigForm, { type SchoolFormState } from '@/components/SchoolConfigForm';
import { AlertCircle, ArrowLeft, Building2, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getCurrentFiscalYear } from '@/lib/fiscalYear';
import { schoolNameToSlug } from '@/lib/schoolSlug';

const EMPTY_FORM: SchoolFormState = {
  name: '',
  type: 'School',
  active: true,
  agencyId: '',
  currentFiscalYear: getCurrentFiscalYear(),
  intakeSessions: [],
  intakeActivities: [],
};

export default function NewSchoolPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const userRole = (session?.user as { role?: string })?.role;
  const isAdmin = userRole === 'Admin';

  useEffect(() => {
    if (status === 'loading') return;

    if (!session) {
      router.push('/auth/signin');
      return;
    }

    if (!isAdmin) {
      router.push('/admin/schools');
    }
  }, [session, status, router, isAdmin]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const res = await fetch('/api/admin/schools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create school/program');

      router.push(`/admin/schools/${schoolNameToSlug(data.name || form.name)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create school/program.');
    } finally {
      setSaving(false);
    }
  }

  if (status === 'loading') {
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
      <div className="w-full max-w-4xl mx-auto p-6 space-y-6">
        <Button variant="outline" onClick={() => router.push('/admin/schools')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to schools
        </Button>

        <div className="space-y-1">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building2 className="h-8 w-8" />
            Add School/Program
          </h1>
          <p className="text-muted-foreground">
            Create a school or program option for new assignments.
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>New entry</CardTitle>
            <CardDescription>
              After saving, you can continue editing intake settings on the school&apos;s detail page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SchoolConfigForm
              form={form}
              setForm={setForm}
              onSubmit={handleCreate}
              saving={saving}
              isDataLead={false}
              mode="create"
              onCancel={() => router.push('/admin/schools')}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
