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
  system: {
    databaseConnected: boolean;
    syncReadyPercent: number;
    thoughtspotConfigured: boolean;
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
            : 'District-wide enrollment, storage utilization, and activity at a glance.'
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
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
                    <Link href="/admin/thoughtspot-analytics">
                      <LineChartIcon className="h-4 w-4" />
                      <span className="text-left">
                        <span className="block text-sm font-medium">ThoughtSpot Analytics</span>
                        <span className="block text-[11px] text-muted-foreground font-normal">
                          {data.system?.thoughtspotConfigured
                            ? 'Liveboard for district enrollment trends'
                            : 'Configure ThoughtSpot in environment to enable'}
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
