'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import AdminHeader from '@/components/AdminHeader';
import { Settings, FlaskConical, Trash2, Database, ArrowRightLeft, Save, Loader2, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { invalidateAppSettings } from '@/lib/useAppSettings';
import type { AppSettings } from '@/lib/useAppSettings';

interface SettingToggle {
  key: keyof AppSettings;
  label: string;
  description: string;
  icon: React.ReactNode;
  danger?: boolean;
}

const DEV_TOOLS: SettingToggle[] = [
  {
    key: 'showSeedTestData',
    label: 'Seed Test Data',
    description: 'Show the "Seed Test Data" button on the main Dashboard. Inserts sample student records for testing.',
    icon: <Database className="h-5 w-5 text-blue-500" />,
  },
  {
    key: 'showSeedCabinets',
    label: 'Seed Smart Cabinets',
    description: 'Show the "Seed Smart Cabinets" button on the main Dashboard. Creates sample cabinet structures.',
    icon: <FlaskConical className="h-5 w-5 text-violet-500" />,
  },
  {
    key: 'showClearAllData',
    label: 'Clear All Data',
    description: 'Show the "Clear All Data" button on the main Dashboard. Permanently deletes all student records.',
    icon: <Trash2 className="h-5 w-5 text-red-500" />,
    danger: true,
  },
  {
    key: 'showMigrateDrawers',
    label: 'Migrate Drawers',
    description: 'Show the "Migrate Drawers" link in the Admin navigation bar. Used for one-time data migrations.',
    icon: <ArrowRightLeft className="h-5 w-5 text-amber-500" />,
  },
];

export default function SettingsPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const role = (session?.user as any)?.role ?? '';

  const [values, setValues] = useState<AppSettings>({
    showSeedTestData: false,
    showSeedCabinets: false,
    showClearAllData: false,
    showMigrateDrawers: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.replace('/admin');
    if (authStatus === 'authenticated' && role !== 'Admin') router.replace('/admin');
  }, [authStatus, role, router]);

  useEffect(() => {
    fetch('/api/admin/app-settings')
      .then(r => r.json())
      .then(data => { setValues(v => ({ ...v, ...data })); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const res = await fetch('/api/admin/app-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Failed to save settings.');
        return;
      }
      invalidateAppSettings(); // clear module-level cache so components re-fetch
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  }

  if (authStatus === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-background">
        <AdminHeader />
        <main className="w-full px-4 sm:px-6 py-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </main>
      </div>
    );
  }

  const anyVisible = DEV_TOOLS.some(t => values[t.key]);

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <main className="w-full px-4 sm:px-6 py-6 max-w-3xl space-y-6">

        {/* Back button */}
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Button>

        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6 text-primary" />
            System Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Admin-only configuration. Changes apply system-wide immediately.
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {saved && (
          <Alert className="border-green-400 bg-green-50 text-green-800">
            <AlertDescription>Settings saved successfully.</AlertDescription>
          </Alert>
        )}

        {/* Dev tools card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <FlaskConical className="h-4 w-4 text-primary" />
                  Developer &amp; Migration Tools
                </CardTitle>
                <CardDescription>
                  These buttons are for testing and one-time data migrations only.
                  Hide them in production to keep the UI clean.
                </CardDescription>
              </div>
              {anyVisible
                ? <Badge className="gap-1 bg-amber-100 text-amber-700 border-amber-300"><Eye className="h-3 w-3" /> Some visible</Badge>
                : <Badge className="gap-1 bg-green-100 text-green-700 border-green-300"><EyeOff className="h-3 w-3" /> All hidden</Badge>
              }
            </div>
          </CardHeader>
          <CardContent className="space-y-0 p-0">
            {DEV_TOOLS.map((tool, i) => (
              <div key={tool.key}>
                {i > 0 && <Separator />}
                <div className={`flex items-start gap-4 px-6 py-4 transition-colors ${
                  values[tool.key]
                    ? tool.danger
                      ? 'bg-red-50/50 dark:bg-red-950/10'
                      : 'bg-primary/5'
                    : ''
                }`}>
                  <div className="mt-0.5 shrink-0">{tool.icon}</div>
                  <div className="flex-1 min-w-0">
                    <Label htmlFor={tool.key} className="text-sm font-medium cursor-pointer flex items-center gap-2">
                      {tool.label}
                      {tool.danger && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Destructive</Badge>}
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">{tool.description}</p>
                  </div>
                  <Switch
                    id={tool.key}
                    checked={values[tool.key]}
                    onCheckedChange={(v: boolean) => setValues(prev => ({ ...prev, [tool.key]: v }))}
                    className={tool.danger && values[tool.key] ? 'data-[state=checked]:bg-red-500' : ''}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Save button */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Settings are stored globally and apply to all users instantly.
          </p>
          <Button onClick={handleSave} disabled={saving} className="gap-2 min-w-28">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
          </Button>
        </div>

      </main>
    </div>
  );
}
