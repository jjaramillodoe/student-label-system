'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Activity,
  AlertCircle,
  Archive,
  BarChart3,
  LayoutGrid,
  LineChart as LineChartIcon,
  Loader2,
  Printer,
  RefreshCw,
  Search,
  Shield,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts';
import PageIntro from '@/components/PageIntro';
import AnalyticsMetricCard from '@/components/AnalyticsMetricCard';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Progress } from '@/components/ui/progress';

type TrendPoint = { date: string; label: string; count: number };

type AnalyticsPayload = {
  timestamp: string;
  scope: 'district' | 'school';
  school: string | null;
  students: {
    total: number;
    active: number;
    archived: number;
    unassigned: number;
    bySchool: Array<{ school: string; count: number }>;
    byStatus: Array<{ status: string; count: number }>;
  };
  enrollment: {
    today: number;
    week: number;
    month: number;
    trend: TrendPoint[];
  };
  cabinets: {
    total: number;
    totalCapacity: number;
    totalUsed: number;
    available: number;
    utilizationPercent: number;
  };
  activity: {
    printsLast30Days: number;
    auditLogsLast7Days: number;
    printsTrend: TrendPoint[];
  };
  searches: {
    last7Days: number;
    last14Days: number;
    zeroResultsLast7Days: number;
    zeroResultRate: number;
    savedCount: number;
    trend: TrendPoint[];
    byKind: Array<{ kind: string; count: number }>;
    bySource: Array<{ source: string; count: number }>;
  };
  accounts: {
    total: number;
    locked: number;
    mfaBypass: number;
    forcePasswordChange: number;
  } | null;
  system: {
    databaseConnected: boolean;
    syncReadyPercent: number;
    motherduckConfigured: boolean;
  } | null;
};

const enrollmentChartConfig = {
  count: { label: 'Enrollments', color: 'hsl(var(--chart-1))' },
} satisfies ChartConfig;

const printsChartConfig = {
  count: { label: 'Print jobs', color: 'hsl(var(--chart-2))' },
} satisfies ChartConfig;

const schoolChartConfig = {
  count: { label: 'Students', color: 'hsl(var(--chart-1))' },
} satisfies ChartConfig;

const searchesChartConfig = {
  count: { label: 'Searches', color: 'hsl(var(--chart-3))' },
} satisfies ChartConfig;

const KIND_LABELS: Record<string, string> = {
  name: 'Name',
  dob: 'Date of birth',
  name_dob: 'Name + DOB',
  id: 'Student / Label ID',
  other: 'Other',
};

const SOURCE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  intake: 'Intake lookup',
  'intake-check': 'Intake duplicate check',
  'all-students': 'All Students',
  'command-palette': 'Command palette',
  lookup: 'Student lookup',
};

const STATUS_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

function utilizationTone(pct: number): 'default' | 'success' | 'warning' {
  if (pct >= 90) return 'warning';
  if (pct >= 60) return 'default';
  return 'success';
}

export default function AnalyticsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const isAdmin = role === 'Admin';
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/analytics');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load analytics');
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/auth/signin');
      return;
    }
    if (!['Admin', 'Data Lead'].includes(role || '')) {
      router.push('/');
      return;
    }
    void load();
  }, [session, status, role, router, load]);

  const statusChartConfig = useMemo(() => {
    const cfg: ChartConfig = {};
    (data?.students.byStatus || []).forEach((row, i) => {
      cfg[row.status] = {
        label: row.status,
        color: STATUS_COLORS[i % STATUS_COLORS.length],
      };
    });
    return cfg;
  }, [data?.students.byStatus]);

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

  return (
    <div className="w-full space-y-6">
      <PageIntro
        eyebrow="Insights"
        title="Analytics"
        description={
          data?.scope === 'school' && data.school
            ? `Enrollment, storage, and print activity for ${data.school}.`
            : 'District-wide enrollment, searches, storage utilization, and activity at a glance.'
        }
        icon={<BarChart3 className="h-5 w-5 text-primary" />}
        actions={
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        }
      />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && !data ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-border/80 shadow-none">
              <CardHeader className="pb-2">
                <Skeleton className="h-3 w-20" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-28" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <AnalyticsMetricCard
              label="Students"
              value={data.students.total}
              description={`${data.students.active.toLocaleString()} active · ${data.students.archived.toLocaleString()} archived`}
              icon={Users}
            />
            <AnalyticsMetricCard
              label="Enrolled today"
              value={data.enrollment.today}
              description={`Week ${data.enrollment.week.toLocaleString()} · Month ${data.enrollment.month.toLocaleString()}`}
              icon={UserPlus}
              tone="info"
            />
            <AnalyticsMetricCard
              label="Cabinet fill"
              value={`${data.cabinets.utilizationPercent}%`}
              description={`${data.cabinets.totalUsed.toLocaleString()} / ${data.cabinets.totalCapacity.toLocaleString()} slots · ${data.cabinets.available.toLocaleString()} free`}
              icon={LayoutGrid}
              tone={utilizationTone(data.cabinets.utilizationPercent)}
              footer={
                <Progress
                  value={Math.min(100, data.cabinets.utilizationPercent)}
                  className="mt-3 h-1.5"
                />
              }
            />
            <AnalyticsMetricCard
              label="Prints (30d)"
              value={data.activity.printsLast30Days}
              description={`${data.activity.auditLogsLast7Days.toLocaleString()} audit events (7d)`}
              icon={Printer}
            />
            <AnalyticsMetricCard
              label="Searches (7d)"
              value={data.searches?.last7Days ?? 0}
              description={
                data.searches
                  ? `${data.searches.zeroResultRate}% zero results · ${data.searches.savedCount.toLocaleString()} saved searches`
                  : 'Search activity starts collecting after this release'
              }
              icon={Search}
              tone="info"
            />
            {isAdmin && data.accounts && (
              <AnalyticsMetricCard
                label="Accounts"
                value={data.accounts.total}
                description={`${data.accounts.mfaBypass.toLocaleString()} MFA disabled · ${data.accounts.locked.toLocaleString()} locked · ${data.accounts.forcePasswordChange.toLocaleString()} must change password`}
                icon={Shield}
                tone={data.accounts.mfaBypass || data.accounts.locked ? 'warning' : 'default'}
              />
            )}
          </div>

          {data.students.unassigned > 0 && (
            <AnalyticsMetricCard
              label="Unassigned students"
              value={data.students.unassigned}
              description="Active records without a cabinet assignment"
              icon={Archive}
              tone="warning"
              className="sm:max-w-sm"
            />
          )}

          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="border-border/80 shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  Enrollments · 14 days
                </CardTitle>
                <CardDescription>New student records created per day</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={enrollmentChartConfig} className="aspect-[2/1] w-full">
                  <AreaChart data={data.enrollment.trend} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      minTickGap={24}
                    />
                    <YAxis
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                      width={28}
                    />
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

            <Card className="border-border/80 shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Printer className="h-4 w-4 text-muted-foreground" />
                  Print activity · 14 days
                </CardTitle>
                <CardDescription>Label print jobs logged per day</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={printsChartConfig} className="aspect-[2/1] w-full">
                  <BarChart data={data.activity.printsTrend} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      minTickGap={24}
                    />
                    <YAxis
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                      width={28}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar
                      dataKey="count"
                      fill="var(--color-count)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          {data.searches && (
            <div className="grid gap-4 xl:grid-cols-2">
              <Card className="border-border/80 shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    Searches · 14 days
                  </CardTitle>
                  <CardDescription>
                    Student lookups from Dashboard, Intake, All Students, and command palette.
                    Raw search text is not stored.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={searchesChartConfig} className="aspect-[2/1] w-full">
                    <AreaChart data={data.searches.trend} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        minTickGap={24}
                      />
                      <YAxis
                        allowDecimals={false}
                        tickLine={false}
                        axisLine={false}
                        width={28}
                      />
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

              <Card className="border-border/80 shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    Search mix · 14 days
                  </CardTitle>
                  <CardDescription>
                    {data.searches.last14Days.toLocaleString()} searches
                    {data.searches.zeroResultsLast7Days > 0
                      ? ` · ${data.searches.zeroResultsLast7Days.toLocaleString()} with no matches (7d)`
                      : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">By query type</p>
                    <div className="space-y-2">
                      {data.searches.byKind.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          No searches logged yet. Numbers appear after staff look up students.
                        </p>
                      ) : (
                        data.searches.byKind.map((row) => {
                          const max = Math.max(1, ...data.searches.byKind.map((k) => k.count));
                          return (
                            <div key={row.kind} className="flex items-center gap-3 text-sm">
                              <span className="w-28 shrink-0 text-muted-foreground">
                                {KIND_LABELS[row.kind] || row.kind}
                              </span>
                              <Progress value={Math.round((row.count / max) * 100)} className="h-1.5 flex-1" />
                              <span className="w-10 text-right tabular-nums">{row.count.toLocaleString()}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">By source</p>
                    <div className="flex flex-wrap gap-2">
                      {(data.searches.bySource.length ? data.searches.bySource : []).map((row) => (
                        <span key={row.source} className="ui-badge-muted text-xs">
                          {SOURCE_LABELS[row.source] || row.source}
                          <span className="ml-1 tabular-nums font-medium text-foreground">
                            {row.count.toLocaleString()}
                          </span>
                        </span>
                      ))}
                      {data.searches.bySource.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          No searches logged yet. Numbers appear after staff look up students.
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            {statusPieData.length > 0 && (
              <Card className="border-border/80 shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    Students by status
                  </CardTitle>
                  <CardDescription>Active filing vs archived and other statuses</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={statusChartConfig} className="mx-auto aspect-square max-h-[260px]">
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                      <Pie
                        data={statusPieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={58}
                        outerRadius={90}
                        strokeWidth={2}
                      >
                        {statusPieData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                  <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {statusPieData.map((row) => (
                      <span key={row.name} className="inline-flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-[2px]"
                          style={{ backgroundColor: row.fill }}
                        />
                        {row.name}
                        <span className="tabular-nums font-medium text-foreground">
                          {row.value.toLocaleString()}
                        </span>
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {isAdmin && schoolBarData.length > 0 && (
              <Card className="border-border/80 shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    Students by school
                  </CardTitle>
                  <CardDescription>Top schools by record count</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={schoolChartConfig} className="aspect-[4/3] w-full min-h-[260px]">
                    <BarChart
                      data={schoolBarData}
                      layout="vertical"
                      margin={{ left: 8, right: 12, top: 4, bottom: 4 }}
                    >
                      <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                      <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                      <YAxis
                        type="category"
                        dataKey="school"
                        width={56}
                        tickLine={false}
                        axisLine={false}
                      />
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

            <Card className={`border-border/80 shadow-none ${isAdmin && schoolBarData.length > 0 ? '' : 'lg:col-span-1'}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  Explore further
                </CardTitle>
                <CardDescription>Open detailed tools for deeper analysis</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2">
                <Button variant="outline" className="justify-start gap-2 h-auto py-3" asChild>
                  <Link href="/admin/enrollment">
                    <UserPlus className="h-4 w-4" />
                    <span className="text-left">
                      <span className="block text-sm font-medium">Enrollment</span>
                      <span className="block text-[11px] text-muted-foreground font-normal">Staff &amp; intake time</span>
                    </span>
                  </Link>
                </Button>
                <Button variant="outline" className="justify-start gap-2 h-auto py-3" asChild>
                  <Link href="/admin/activity-report">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-left">
                      <span className="block text-sm font-medium">Activity Report</span>
                      <span className="block text-[11px] text-muted-foreground font-normal">User actions</span>
                    </span>
                  </Link>
                </Button>
                <Button variant="outline" className="justify-start gap-2 h-auto py-3" asChild>
                  <Link href="/reports">
                    <Printer className="h-4 w-4" />
                    <span className="text-left">
                      <span className="block text-sm font-medium">Print Reports</span>
                      <span className="block text-[11px] text-muted-foreground font-normal">Label volume</span>
                    </span>
                  </Link>
                </Button>
                <Button variant="outline" className="justify-start gap-2 h-auto py-3" asChild>
                  <Link href="/admin/cabinets">
                    <LayoutGrid className="h-4 w-4" />
                    <span className="text-left">
                      <span className="block text-sm font-medium">Cabinets</span>
                      <span className="block text-[11px] text-muted-foreground font-normal">Storage detail</span>
                    </span>
                  </Link>
                </Button>
                {isAdmin && (
                  <Button variant="outline" className="justify-start gap-2 h-auto py-3 sm:col-span-2" asChild>
                    <Link href="/admin/motherduck-analytics">
                      <LineChartIcon className="h-4 w-4" />
                      <span className="text-left">
                        <span className="block text-sm font-medium">MotherDuck Analytics</span>
                        <span className="block text-[11px] text-muted-foreground font-normal">
                          {data.system?.motherduckConfigured
                            ? 'Warehouse analytics synced from MongoDB'
                            : 'Configure MOTHERDUCK_TOKEN to enable'}
                        </span>
                      </span>
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {data.timestamp && (
            <p className="text-[11px] text-muted-foreground">
              Updated {new Date(data.timestamp).toLocaleString()}
              {data.system ? ` · Sync-ready ${data.system.syncReadyPercent}%` : ''}
            </p>
          )}
        </>
      ) : null}
    </div>
  );
}
