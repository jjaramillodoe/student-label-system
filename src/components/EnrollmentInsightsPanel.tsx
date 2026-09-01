'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  CalendarDays, CheckCircle2, Clock, Languages, LogOut, UserPlus,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import AnalyticsMetricCard from '@/components/AnalyticsMetricCard';
import type { EnrollmentInsights } from '@/lib/enrollmentInsights';
import { Skeleton } from '@/components/ui/skeleton';

const dailyConfig = {
  newFiles: { label: 'New files', color: 'hsl(var(--chart-1))' },
  visits: { label: 'Visits', color: 'hsl(var(--chart-2))' },
} satisfies ChartConfig;

const sessionConfig = {
  count: { label: 'Visits', color: 'hsl(var(--chart-1))' },
} satisfies ChartConfig;

const hourConfig = {
  count: { label: 'Arrivals', color: 'hsl(var(--chart-3))' },
} satisfies ChartConfig;

function fmtDayTick(date: string) {
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function EnrollmentInsightsPanel({
  insights,
  loading,
}: {
  insights: EnrollmentInsights | null;
  loading: boolean;
}) {
  if (loading && !insights) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (!insights) return null;

  const clockTone = insights.clockOutRate !== null && insights.clockOutRate < 80 ? 'warning' : 'success';
  const openTone = insights.openVisits > 0 ? 'warning' : 'default';

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <AnalyticsMetricCard
          label="New files"
          value={insights.newFiles}
          description="First-time registrations in this period"
          icon={UserPlus}
          tone="info"
        />
        <AnalyticsMetricCard
          label="Intake visits"
          value={insights.visits}
          description={`${insights.returningVisits.toLocaleString()} returning · same-day return counts`}
          icon={Clock}
        />
        <AnalyticsMetricCard
          label="Clock-out rate"
          value={insights.clockOutRate === null ? '—' : `${insights.clockOutRate}%`}
          description={`${insights.clockedOutVisits.toLocaleString()} left with Time Out · ${insights.openVisits.toLocaleString()} still open`}
          icon={CheckCircle2}
          tone={insights.clockOutRate === null ? 'default' : clockTone}
        />
        <AnalyticsMetricCard
          label="Open visits"
          value={insights.openVisits}
          description="Staying or missing Time Out in this period"
          icon={LogOut}
          tone={openTone}
        />
        <AnalyticsMetricCard
          label="BE / ESL"
          value={`${insights.beStudents} / ${insights.eslStudents}`}
          description="Students with a visit in this period"
          icon={Languages}
        />
        <AnalyticsMetricCard
          label="Sessions used"
          value={insights.sessionMix.length}
          description={
            insights.sessionMix[0]
              ? `Busiest: ${insights.sessionMix[0].name} (${insights.sessionMix[0].count})`
              : 'No session data yet'
          }
          icon={CalendarDays}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/80 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Intake by session</CardTitle>
            <CardDescription>Visit counts for the selected period</CardDescription>
          </CardHeader>
          <CardContent>
            {insights.sessionMix.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-8 text-center">No session mix for this period.</p>
            ) : (
              <ChartContainer config={sessionConfig} className="aspect-[16/9] w-full">
                <BarChart
                  data={insights.sessionMix}
                  layout="vertical"
                  margin={{ left: 8, right: 12, top: 4, bottom: 4 }}
                >
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={108}
                    tickLine={false}
                    axisLine={false}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="var(--color-count)" radius={4} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Arrivals by hour</CardTitle>
            <CardDescription>Time In (school clock), not EPE-rounded</CardDescription>
          </CardHeader>
          <CardContent>
            {insights.hourMix.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-8 text-center">No arrival times for this period.</p>
            ) : (
              <ChartContainer config={hourConfig} className="aspect-[16/9] w-full">
                <BarChart data={insights.hourMix} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function EnrollmentDailyTrendChart({
  daily,
  loading,
}: {
  daily: DailyMixPointLike[];
  loading: boolean;
}) {
  if (loading && daily.length === 0) {
    return <Skeleton className="h-40 w-full" />;
  }
  if (daily.length === 0) {
    return <p className="text-sm text-muted-foreground italic py-8 text-center">No trend data yet.</p>;
  }
  return (
    <ChartContainer config={dailyConfig} className="aspect-[2/1] w-full min-h-[180px]">
      <BarChart data={daily} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tickFormatter={fmtDayTick}
        />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
        <ChartTooltip
          content={<ChartTooltipContent labelFormatter={(value) => fmtDayTick(String(value))} />}
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="newFiles" fill="var(--color-newFiles)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="visits" fill="var(--color-visits)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

type DailyMixPointLike = { date: string; newFiles: number; visits: number };
