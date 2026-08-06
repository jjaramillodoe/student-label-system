'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Database,
  Loader2,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts';
import PageIntro from '@/components/PageIntro';
import AnalyticsMetricCard from '@/components/AnalyticsMetricCard';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

type StatusResponse = {
  configured: boolean;
  connected: boolean;
  latencyMs?: number;
  host: string;
  database: string;
  studentCount: number | null;
  lastSyncedAt: string | null;
  message?: string;
};

type AnalyticsPayload = {
  source: 'motherduck';
  timestamp: string;
  lastSyncedAt: string | null;
  students: {
    total: number;
    active: number;
    archived: number;
    bySchool: Array<{ school: string; count: number }>;
    byStatus: Array<{ status: string; count: number }>;
  };
  enrollment: {
    today: number;
    week: number;
    month: number;
    trend: Array<{ date: string; label: string; count: number }>;
  };
};

const enrollmentChartConfig = {
  count: { label: 'Enrollments', color: 'hsl(var(--chart-1))' },
} satisfies ChartConfig;

const schoolChartConfig = {
  count: { label: 'Students', color: 'hsl(var(--chart-2))' },
} satisfies ChartConfig;

const STATUS_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export default function MotherDuckAnalyticsPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const role = session?.user?.role ?? '';

  const [mdStatus, setMdStatus] = useState<StatusResponse | null>(null);
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [syncMessage, setSyncMessage] = useState('');

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.replace('/auth/signin');
    if (authStatus === 'authenticated' && role !== 'Admin') router.replace('/');
  }, [authStatus, role, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const statusRes = await fetch('/api/admin/motherduck/status');
      const statusJson = await statusRes.json();
      if (!statusRes.ok) throw new Error(statusJson.error || 'Failed to load MotherDuck status');
      setMdStatus(statusJson);

      if (statusJson.configured && statusJson.connected) {
        const analyticsRes = await fetch('/api/admin/motherduck/analytics');
        const analyticsJson = await analyticsRes.json();
        if (!analyticsRes.ok) {
          throw new Error(analyticsJson.details || analyticsJson.error || 'Failed to query MotherDuck');
        }
        setData(analyticsJson);
      } else {
        setData(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load MotherDuck analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === 'authenticated' && role === 'Admin') void load();
  }, [authStatus, role, load]);

  async function runSync() {
    setSyncing(true);
    setSyncMessage('');
    setError('');
    try {
      const res = await fetch('/api/admin/motherduck/sync', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.details || json.error || 'Sync failed');
      setSyncMessage(
        `Synced ${Number(json.synced).toLocaleString()} students to ${json.database} in ${json.durationMs}ms.`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  const statusPieData = useMemo(
    () =>
      (data?.students.byStatus || []).map((row, i) => ({
        name: row.status,
        value: row.count,
        fill: STATUS_COLORS[i % STATUS_COLORS.length],
      })),
    [data?.students.byStatus],
  );

  const schoolBarData = useMemo(
    () =>
      (data?.students.bySchool || []).map((row) => ({
        school: row.school.replace(/^School\s+/i, 'S'),
        fullSchool: row.school,
        count: row.count,
      })),
    [data?.students.bySchool],
  );

  if (authStatus === 'loading' || (authStatus === 'authenticated' && role !== 'Admin')) {
    return null;
  }

  return (
    <div className="w-full space-y-6">
      <PageIntro
        eyebrow="Admin"
        title="MotherDuck Analytics"
        description="Warehouse analytics powered by MotherDuck (DuckDB). Sync student records from MongoDB, then explore district enrollment."
        icon={<Database className="h-5 w-5 text-primary" />}
        back={
          <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit text-muted-foreground">
            <Link href="/admin/analytics">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Analytics
            </Link>
          </Button>
        }
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void load()}
              disabled={loading || syncing}
              className="gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => void runSync()}
              disabled={!mdStatus?.configured || syncing || loading}
              className="gap-2"
            >
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Sync from MongoDB
            </Button>
          </>
        }
      />

      <Separator />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {syncMessage && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{syncMessage}</AlertDescription>
        </Alert>
      )}

      {loading && !mdStatus ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : mdStatus && !mdStatus.configured ? (
        <Alert>
          <AlertTitle>MotherDuck not configured yet</AlertTitle>
          <AlertDescription className="space-y-3 text-sm">
            <p>
              Create a free account at{' '}
              <a
                href="https://app.motherduck.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                app.motherduck.com
              </a>
              , generate an access token, then set these environment variables:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <code>MOTHERDUCK_TOKEN</code> — access token (required)
              </li>
              <li>
                <code>MOTHERDUCK_DATABASE</code> — defaults to <code>student_label_analytics</code>
              </li>
              <li>
                <code>MOTHERDUCK_HOST</code> — defaults to <code>pg.us-east-1-aws.motherduck.com</code>
              </li>
            </ul>
            <p className="text-muted-foreground">
              After deploy, open this page and click <strong>Sync from MongoDB</strong> to load the warehouse.
            </p>
          </AlertDescription>
        </Alert>
      ) : mdStatus ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <AnalyticsMetricCard
              label="Connection"
              value={mdStatus.connected ? 'Connected' : 'Error'}
              description={`${mdStatus.database} · ${mdStatus.latencyMs ?? '—'}ms`}
              icon={Database}
              tone={mdStatus.connected ? 'success' : 'warning'}
            />
            <AnalyticsMetricCard
              label="Warehouse rows"
              value={mdStatus.studentCount ?? 0}
              description="Students table in MotherDuck"
              icon={BarChart3}
            />
            <AnalyticsMetricCard
              label="Last sync"
              value={
                mdStatus.lastSyncedAt
                  ? new Date(mdStatus.lastSyncedAt).toLocaleString()
                  : 'Never'
              }
              description="MongoDB → MotherDuck snapshot"
              icon={Upload}
            />
            <AnalyticsMetricCard
              label="Host"
              value={mdStatus.host.replace('pg.', '').split('.')[0] || 'aws'}
              description={mdStatus.host}
              icon={Activity}
              tone="info"
            />
          </div>

          {data && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <AnalyticsMetricCard
                  label="Students"
                  value={data.students.total}
                  description={`${data.students.active.toLocaleString()} active · ${data.students.archived.toLocaleString()} archived`}
                  icon={BarChart3}
                />
                <AnalyticsMetricCard
                  label="Enrolled today"
                  value={data.enrollment.today}
                  description={`Week ${data.enrollment.week.toLocaleString()} · Month ${data.enrollment.month.toLocaleString()}`}
                  icon={Activity}
                  tone="info"
                />
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <Card className="border-border/80 shadow-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Enrollments · 14 days</CardTitle>
                    <CardDescription>From MotherDuck created_at</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer config={enrollmentChartConfig} className="aspect-[2/1] w-full">
                      <AreaChart data={data.enrollment.trend} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
                        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
                        <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                        <Area
                          type="monotone"
                          dataKey="count"
                          stroke="var(--color-count)"
                          fill="var(--color-count)"
                          fillOpacity={0.15}
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ChartContainer>
                  </CardContent>
                </Card>

                {statusPieData.length > 0 && (
                  <Card className="border-border/80 shadow-none">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Students by status</CardTitle>
                      <CardDescription>Queried from MotherDuck</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer config={{}} className="mx-auto aspect-square max-h-[240px]">
                        <PieChart>
                          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                          <Pie data={statusPieData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={84}>
                            {statusPieData.map((entry) => (
                              <Cell key={entry.name} fill={entry.fill} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>
                )}
              </div>

              {schoolBarData.length > 0 && (
                <Card className="border-border/80 shadow-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Students by school</CardTitle>
                    <CardDescription>Top schools in the warehouse</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer config={schoolChartConfig} className="aspect-[21/9] w-full min-h-[220px]">
                      <BarChart data={schoolBarData} layout="vertical" margin={{ left: 8, right: 12, top: 4, bottom: 4 }}>
                        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                        <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                        <YAxis type="category" dataKey="school" width={56} tickLine={false} axisLine={false} />
                        <ChartTooltip
                          content={
                            <ChartTooltipContent
                              labelFormatter={(_, payload) => {
                                const row = payload?.[0]?.payload as { fullSchool?: string } | undefined;
                                return row?.fullSchool || '';
                              }}
                            />
                          }
                        />
                        <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ChartContainer>
                  </CardContent>
                </Card>
              )}

              {data.lastSyncedAt && (
                <p className="text-[11px] text-muted-foreground">
                  Warehouse snapshot from {new Date(data.lastSyncedAt).toLocaleString()} · queried{' '}
                  {new Date(data.timestamp).toLocaleString()}
                </p>
              )}
            </>
          )}

          {mdStatus.connected && (!data || data.students.total === 0) && !loading && (
            <Alert>
              <AlertTitle>Warehouse is empty</AlertTitle>
              <AlertDescription>
                Click <strong>Sync from MongoDB</strong> to load student records into MotherDuck, then refresh charts.
              </AlertDescription>
            </Alert>
          )}
        </>
      ) : null}
    </div>
  );
}
