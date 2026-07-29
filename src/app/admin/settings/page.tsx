'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AdminHeader from '@/components/AdminHeader';
import {
  Settings,
  FlaskConical,
  Trash2,
  Database,
  ArrowRightLeft,
  Save,
  Loader2,
  Eye,
  EyeOff,
  ArrowLeft,
  Activity,
  RefreshCw,
  HardDrive,
  Users,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Link2,
  AlertTriangle,
  BookOpen,
  HeartPulse,
  Server,
  Gauge,
  Zap,
  Mail,
  GraduationCap,
  SlidersHorizontal,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { invalidateAppSettings } from '@/lib/useAppSettings';
import type { AppSettings } from '@/lib/useAppSettings';
import { formatBytes, type SystemStats } from '@/lib/systemStats.types';

interface SettingToggle {
  key: 'showSeedTestData' | 'showSeedCabinets' | 'showClearAllData' | 'showMigrateDrawers';
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
    notifyLowStockEmail: true,
    notifyIntakeIssuesEmail: true,
    notificationRecipients: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState('');
  const [notifyBusy, setNotifyBusy] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState('');

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError('');
    try {
      const res = await fetch('/api/admin/system-stats');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load system statistics');
      setStats(data);
    } catch (err) {
      setStatsError(err instanceof Error ? err.message : 'Failed to load system statistics.');
    } finally {
      setStatsLoading(false);
    }
  }, []);

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

  useEffect(() => {
    if (authStatus === 'authenticated' && role === 'Admin') {
      fetchStats();
    }
  }, [authStatus, role, fetchStats]);

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

  async function runNotificationAction(action: 'test' | 'intake-digest') {
    setNotifyBusy(true);
    setNotifyMessage('');
    try {
      // Persist toggles first so digest/test use latest preferences
      await fetch('/api/admin/app-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notifyLowStockEmail: values.notifyLowStockEmail,
          notifyIntakeIssuesEmail: values.notifyIntakeIssuesEmail,
          notificationRecipients: values.notificationRecipients,
        }),
      });
      const res = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotifyMessage(data.error || 'Notification action failed.');
        return;
      }
      if (action === 'test') {
        setNotifyMessage(`Test email sent to ${data.to}.`);
      } else if (data.ok) {
        setNotifyMessage(`Intake digest sent (${data.issueCount} issue(s)) to ${data.recipientCount} recipient(s).`);
      } else {
        setNotifyMessage(data.reason || `No digest sent (${data.issueCount ?? 0} issue(s)).`);
      }
    } catch {
      setNotifyMessage('Notification action failed.');
    } finally {
      setNotifyBusy(false);
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
      <main className="w-full p-6 space-y-6">

        {/* Back button + header */}
        <div className="space-y-4">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
          </Button>

          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Settings className="h-6 w-6 text-primary" />
              System Settings
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Admin-only configuration. Changes apply system-wide immediately.
            </p>
          </div>
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

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] items-start">
          {/* Left — system status (uses full remaining width) */}
          <div className="space-y-6 min-w-0">
        {/* System status card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  System Status
                </CardTitle>
                <CardDescription>
                  Read-only database and integration overview. Refreshed on load.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchStats}
                disabled={statsLoading}
                className="shrink-0 gap-2"
              >
                {statsLoading
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <RefreshCw className="h-4 w-4" />}
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {statsError && (
              <Alert variant="destructive">
                <AlertDescription>{statsError}</AlertDescription>
              </Alert>
            )}

            {statsLoading && !stats ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : stats ? (
              <>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="capitalize">{stats.operational.environment}</Badge>
                  {stats.database.connected && stats.database.latencyMs != null && (
                    <span>MongoDB {stats.database.latencyMs} ms</span>
                  )}
                  {stats.operational.gitCommit && (
                    <span>Commit {stats.operational.gitCommit}</span>
                  )}
                  <span>Updated {new Date(stats.timestamp).toLocaleString()}</span>
                </div>

                <div>
                  <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
                    <HardDrive className="h-4 w-4 text-muted-foreground" />
                    Database storage
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <StatTile label="Data size" value={formatBytes(stats.database.dataSizeBytes)} />
                    <StatTile label="Storage" value={formatBytes(stats.database.storageSizeBytes)} />
                    <StatTile label="Indexes" value={formatBytes(stats.database.indexSizeBytes)} />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    Collection counts
                  </h3>
                  <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
                    {Object.entries(stats.database.collections).map(([name, count]) => (
                      <StatTile key={name} label={name.replace(/_/g, ' ')} value={count.toLocaleString()} />
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-2 border-t text-sm">
                  <a
                    href="/api/health"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    Liveness check
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <a
                    href="/api/health/deep"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    Deep health JSON
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <Link href="/docs/api" className="inline-flex items-center gap-1 text-primary hover:underline">
                    API documentation
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

            {stats && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Server className="h-4 w-4 text-primary" />
                  Operational
                </CardTitle>
                <CardDescription>Environment, deployment, and recent activity.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <StatTile label="Environment" value={stats.operational.environment} />
                  <StatTile
                    label="Git branch"
                    value={stats.operational.gitBranch ?? '—'}
                  />
                  <StatTile
                    label="Git commit"
                    value={stats.operational.gitCommit ?? '—'}
                  />
                  <StatTile
                    label="Deployment"
                    value={stats.operational.deploymentId ? stats.operational.deploymentId.slice(0, 10) : 'Local'}
                    sub={stats.operational.vercelUrl}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <StatTile label="Audit logs (7 days)" value={stats.activity.auditLogsLast7Days.toLocaleString()} />
                  <StatTile label="Print jobs (30 days)" value={stats.activity.printsLast30Days.toLocaleString()} />
                </div>
              </CardContent>
            </Card>
            )}

            {stats && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-primary" />
                  Capacity
                </CardTitle>
                <CardDescription>Cabinet utilization and largest collections by storage size.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border bg-muted/30 px-4 py-3">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="font-medium">Cabinet utilization</span>
                    <span className="tabular-nums font-semibold">{stats.cabinets.utilizationPercent}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${Math.min(stats.cabinets.utilizationPercent, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {stats.cabinets.totalUsed.toLocaleString()} used of {stats.cabinets.totalCapacity.toLocaleString()} slots
                    across {stats.cabinets.total} cabinets
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Largest collections</p>
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-xs text-muted-foreground">
                        <tr>
                          <th className="text-left font-medium px-3 py-2">Collection</th>
                          <th className="text-right font-medium px-3 py-2">Documents</th>
                          <th className="text-right font-medium px-3 py-2">Storage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.database.collectionSizes.slice(0, 8).map((col) => (
                          <tr key={col.name} className="border-t">
                            <td className="px-3 py-2 font-mono text-xs">{col.name}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{col.count.toLocaleString()}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{formatBytes(col.storageSizeBytes)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>
            )}

            {stats && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Student data health
                </CardTitle>
                <CardDescription>
                  Same counts as the dashboard. Amber rows need attention before sync or placement workflows.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-0 p-0">
                <HealthMetric
                  label="Total students"
                  value={stats.students.total.toLocaleString()}
                  description="All student records in the database."
                />
                <Separator />
                <HealthMetric
                  label="Active students"
                  value={stats.students.active.toLocaleString()}
                  description="Not archived — same logic as the dashboard."
                />
                <Separator />
                <HealthMetric
                  label="Archived students"
                  value={stats.students.archived.toLocaleString()}
                  description="Records marked archived."
                />
                <Separator />
                <HealthMetric
                  label="Missing updatedAt"
                  value={stats.students.missingUpdatedAt.toLocaleString()}
                  description="Required for Power Automate / Dynamics delta sync. Run the updatedAt backfill if this is not zero."
                  warn={stats.students.missingUpdatedAt > 0}
                  actionHref="/docs/api"
                  actionLabel="Sync API docs"
                />
                <Separator />
                <HealthMetric
                  label="Without cabinet assignment"
                  value={stats.students.missingCabinet.toLocaleString()}
                  description="Active students with no cabinet — ties to the unassigned students workflow."
                  warn={stats.students.missingCabinet > 0}
                  actionHref="/admin/unassigned"
                  actionLabel="Review unassigned"
                />
                <Separator />
                <HealthMetric
                  label="Unmigrated student IDs"
                  value={stats.students.unmigratedStudentIds.toLocaleString()}
                  description="Records still missing labelId — run Backfill Student IDs on the Schools page."
                  warn={stats.students.unmigratedStudentIds > 0}
                  actionHref="/admin/schools"
                  actionLabel="Backfill IDs"
                />
                <Separator />
                <div className="px-6 py-3 bg-muted/20">
                  <p className="text-xs text-muted-foreground">
                    Sync-ready: <span className="font-medium text-foreground">{stats.students.syncReadyPercent}%</span>
                    {' '}of students have updatedAt set.
                  </p>
                </div>
              </CardContent>
            </Card>
            )}

            {stats && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  Sync &amp; API
                </CardTitle>
                <CardDescription>Power Automate export activity and API endpoints.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <StatTile
                    label="Sync API"
                    value={stats.sync.apiConfigured ? 'Configured' : 'Not configured'}
                    warn={!stats.sync.apiConfigured}
                  />
                  <StatTile
                    label="Last export"
                    value={
                      stats.sync.lastExport
                        ? new Date(stats.sync.lastExport.exportedAt).toLocaleString()
                        : 'No exports logged yet'
                    }
                    sub={
                      stats.sync.lastExport
                        ? `${stats.sync.lastExport.recordCount} records · since ${stats.sync.lastExport.since.slice(0, 10)}`
                        : 'Exports are logged when Power Automate calls the sync API'
                    }
                  />
                </div>
                <div className="flex flex-wrap gap-3 text-sm">
                  <Link href="/docs/api" className="inline-flex items-center gap-1 text-primary hover:underline">
                    <BookOpen className="h-3.5 w-3.5" />
                    API docs
                  </Link>
                  <a href="/api/health" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                    <HeartPulse className="h-3.5 w-3.5" />
                    Liveness
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <a href="/api/health/deep" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                    <HeartPulse className="h-3.5 w-3.5" />
                    Deep health
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <a href="/api/openapi.json" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                    OpenAPI JSON
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </CardContent>
            </Card>
            )}

            {stats && stats.students.bySchool.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-primary" />
                  Students by school
                </CardTitle>
                <CardDescription>Top schools by record count — useful for spotting uneven growth.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs text-muted-foreground">
                      <tr>
                        <th className="text-left font-medium px-3 py-2">School</th>
                        <th className="text-right font-medium px-3 py-2">Students</th>
                        <th className="text-right font-medium px-3 py-2">Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.students.bySchool.map((row) => (
                        <tr key={row.school} className="border-t">
                          <td className="px-3 py-2">{row.school}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{row.count.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                            {stats.students.total > 0
                              ? `${Math.round((row.count / stats.students.total) * 1000) / 10}%`
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
            )}
          </div>

          {/* Right — config + quick actions */}
          <div className="space-y-6 xl:sticky xl:top-6">
            {stats && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Integrations status
                  </CardTitle>
                  <CardDescription>
                    On/off only — secrets are never shown.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-0 p-0">
                  {stats.integrations.map((item, i) => (
                    <div key={item.id}>
                      {i > 0 && <Separator />}
                      <IntegrationRow item={item} />
                    </div>
                  ))}
                  {stats.database.connected && stats.database.latencyMs != null && (
                    <>
                      <Separator />
                      <div className="px-6 py-3 text-xs text-muted-foreground">
                        MongoDB response time: {stats.database.latencyMs} ms
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {stats && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <SlidersHorizontal className="h-4 w-4 text-primary" />
                    App defaults
                  </CardTitle>
                  <CardDescription>System-wide defaults and dev tool visibility.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Current fiscal year</span>
                    <span className="font-medium">{stats.appDefaults.currentFiscalYear}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Default intake sessions</span>
                    <span className="font-medium">{stats.appDefaults.defaultIntakeSessionCount} options</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Default intake activities</span>
                    <span className="font-medium">{stats.appDefaults.defaultIntakeActivityCount} options</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Dev tools visible</span>
                    <Badge variant={stats.appDefaults.devToolsVisible > 0 ? 'destructive' : 'secondary'}>
                      {stats.appDefaults.devToolsVisible} of 4
                    </Badge>
                  </div>
                  <Link href="/admin/schools" className="text-xs text-primary hover:underline inline-block">
                    Edit per-school intake settings →
                  </Link>
                </CardContent>
              </Card>
            )}

            {stats && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-primary" />
                    Quick actions
                  </CardTitle>
                  <CardDescription>
                    Shortcuts based on current system state.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(stats.students.missingCabinet > 0 ||
                    stats.students.unmigratedStudentIds > 0 ||
                    stats.students.missingUpdatedAt > 0) && (
                    <div className="rounded-lg border border-amber-300 bg-amber-50/50 dark:bg-amber-950/10 dark:border-amber-800 px-3 py-2 mb-3">
                      <p className="text-xs font-medium flex items-center gap-1 text-amber-800 dark:text-amber-300">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Data health items need attention
                      </p>
                    </div>
                  )}
                  <QuickLink
                    href="/admin/unassigned"
                    label="Unassigned students"
                    detail={
                      stats.students.missingCabinet > 0
                        ? `${stats.students.missingCabinet} missing cabinet`
                        : 'Review placement queue'
                    }
                    warn={stats.students.missingCabinet > 0}
                  />
                  <QuickLink
                    href="/admin/schools"
                    label="School configuration"
                    detail="Backfill student IDs & intake settings"
                    warn={stats.students.unmigratedStudentIds > 0}
                  />
                  <QuickLink
                    href="/admin/cabinet-health"
                    label="Cabinet health"
                    detail={`${stats.cabinets.utilizationPercent}% utilization`}
                  />
                  <QuickLink
                    href="/docs/api"
                    label="API documentation"
                    detail="Swagger / OpenAPI reference"
                    icon={<BookOpen className="h-4 w-4" />}
                  />
                  <QuickLink
                    href="/api/health/deep"
                    label="Health check"
                    detail="Deep readiness JSON"
                    external
                    icon={<HeartPulse className="h-4 w-4" />}
                  />
                </CardContent>
              </Card>
            )}

        {/* Email notifications */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              Email notifications
            </CardTitle>
            <CardDescription>
              Uses <code className="text-xs">EMAIL_SERVER</code> / <code className="text-xs">EMAIL_FROM</code>.
              Low-stock alerts send when stock is updated at or below threshold (max once per template / 24h).
              Intake digests can be sent manually or via weekday cron.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Label htmlFor="notifyLowStockEmail" className="text-sm font-medium">Low label stock alerts</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Email Admins / Data Leads when stock hits the threshold.</p>
              </div>
              <Switch
                id="notifyLowStockEmail"
                checked={values.notifyLowStockEmail}
                onCheckedChange={(v: boolean) => setValues(prev => ({ ...prev, notifyLowStockEmail: v }))}
              />
            </div>
            <Separator />
            <div className="flex items-start justify-between gap-4">
              <div>
                <Label htmlFor="notifyIntakeIssuesEmail" className="text-sm font-medium">Intake issues digest</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Email when session/handoff issues need review.</p>
              </div>
              <Switch
                id="notifyIntakeIssuesEmail"
                checked={values.notifyIntakeIssuesEmail}
                onCheckedChange={(v: boolean) => setValues(prev => ({ ...prev, notifyIntakeIssuesEmail: v }))}
              />
            </div>
            <Separator />
            <div className="space-y-2">
              <Label htmlFor="notificationRecipients">Recipients (optional)</Label>
              <Input
                id="notificationRecipients"
                value={values.notificationRecipients}
                onChange={(e) => setValues(prev => ({ ...prev, notificationRecipients: e.target.value }))}
                placeholder="Leave blank = all Admin + Data Lead emails"
              />
              <p className="text-xs text-muted-foreground">Comma-separated DOE emails. Blank uses every Admin and Data Lead user.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={notifyBusy}
                onClick={() => runNotificationAction('test')}
              >
                {notifyBusy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Send test email
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={notifyBusy}
                onClick={() => runNotificationAction('intake-digest')}
              >
                Send intake digest now
              </Button>
            </div>
            {notifyMessage && (
              <p className="text-sm text-muted-foreground">{notifyMessage}</p>
            )}
          </CardContent>
        </Card>

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
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Settings are stored globally and apply to all users instantly.
          </p>
          <Button onClick={handleSave} disabled={saving} className="gap-2 w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
          </Button>
        </div>
          </div>
        </div>

      </main>
    </div>
  );
}

function IntegrationRow({ item }: { item: { label: string; configured: boolean; note?: string } }) {
  return (
    <div className="flex items-center justify-between gap-3 px-6 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-medium">{item.label}</p>
        {item.note && <p className="text-xs text-muted-foreground">{item.note}</p>}
      </div>
      <Badge
        variant="outline"
        className={
          item.configured
            ? 'shrink-0 bg-green-50 text-green-800 border-green-300 dark:bg-green-950/20 dark:text-green-300'
            : 'shrink-0 bg-muted text-muted-foreground'
        }
      >
        {item.configured ? 'On' : 'Off'}
      </Badge>
    </div>
  );
}

function HealthMetric({
  label,
  value,
  description,
  warn,
  actionHref,
  actionLabel,
}: {
  label: string;
  value: string;
  description: string;
  warn?: boolean;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div
      className={`flex items-start justify-between gap-4 px-6 py-4 ${
        warn ? 'bg-amber-50/50 dark:bg-amber-950/10' : ''
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{label}</p>
          {warn && (
            <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700 dark:text-amber-400">
              Needs attention
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        {warn && actionHref && actionLabel && (
          <Link href={actionHref} className="text-xs text-primary hover:underline mt-1 inline-block">
            {actionLabel} →
          </Link>
        )}
      </div>
      <p
        className={`text-xl font-semibold tabular-nums shrink-0 ${
          warn ? 'text-amber-700 dark:text-amber-400' : ''
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function QuickLink({
  href,
  label,
  detail,
  warn,
  external,
  icon,
}: {
  href: string;
  label: string;
  detail: string;
  warn?: boolean;
  external?: boolean;
  icon?: React.ReactNode;
}) {
  const className = `flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-muted/50 ${
    warn ? 'border-amber-300 bg-amber-50/30 dark:bg-amber-950/10' : ''
  }`;

  const content = (
    <>
      <span className="mt-0.5 shrink-0 text-muted-foreground">{icon ?? <ExternalLink className="h-4 w-4" />}</span>
      <span className="min-w-0 flex-1">
        <span className="text-sm font-medium block">{label}</span>
        <span className="text-xs text-muted-foreground block">{detail}</span>
      </span>
    </>
  );

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {content}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {content}
    </Link>
  );
}

function StatTile({
  label,
  value,
  sub,
  warn,
}: {
  label: string;
  value: string;
  sub?: string;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-3 py-2.5 ${
        warn ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/10 dark:border-amber-800' : 'bg-muted/30'
      }`}
    >
      <p className="text-[11px] text-muted-foreground capitalize">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${warn ? 'text-amber-700 dark:text-amber-400' : ''}`}>
        {value}
      </p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}
