'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Activity, AlertCircle, BarChart3, LayoutGrid, LineChart, Loader2,
  Printer, RefreshCw, TrendingUp, UserPlus, Users,
} from 'lucide-react';
import PageIntro from '@/components/PageIntro';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

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
  };
  enrollment: { today: number; week: number; month: number };
  cabinets: {
    total: number;
    totalCapacity: number;
    totalUsed: number;
    utilizationPercent: number;
  };
  activity: { printsLast30Days: number; auditLogsLast7Days: number };
  system: {
    databaseConnected: boolean;
    syncReadyPercent: number;
    thoughtspotConfigured: boolean;
  } | null;
};

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

  const maxSchool = Math.max(...(data?.students.bySchool.map((s) => s.count) || [1]), 1);

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
        <div className="flex flex-wrap gap-x-8 gap-y-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-24" />
          ))}
        </div>
      ) : data ? (
        <>
          <div className="flex flex-wrap gap-x-8 gap-y-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Students</p>
              <p className="text-xl font-semibold tabular-nums tracking-tight">{data.students.total.toLocaleString()}</p>
              <p className="text-[11px] text-muted-foreground">
                {data.students.active.toLocaleString()} active · {data.students.archived.toLocaleString()} archived
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Enrolled today</p>
              <p className="text-xl font-semibold tabular-nums tracking-tight">{data.enrollment.today.toLocaleString()}</p>
              <p className="text-[11px] text-muted-foreground">
                Week {data.enrollment.week.toLocaleString()} · Month {data.enrollment.month.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Cabinet fill</p>
              <p className="text-xl font-semibold tabular-nums tracking-tight">{data.cabinets.utilizationPercent}%</p>
              <p className="text-[11px] text-muted-foreground">
                {data.cabinets.totalUsed.toLocaleString()} / {data.cabinets.totalCapacity.toLocaleString()} slots
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Prints (30d)</p>
              <p className="text-xl font-semibold tabular-nums tracking-tight">{data.activity.printsLast30Days.toLocaleString()}</p>
              <p className="text-[11px] text-muted-foreground">
                {data.activity.auditLogsLast7Days.toLocaleString()} audit events (7d)
              </p>
            </div>
            {data.students.unassigned > 0 && (
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Unassigned</p>
                <p className="text-xl font-semibold tabular-nums tracking-tight text-amber-700 dark:text-amber-300">
                  {data.students.unassigned.toLocaleString()}
                </p>
                <p className="text-[11px] text-muted-foreground">Active without cabinet</p>
              </div>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {isAdmin && data.students.bySchool.length > 0 && (
              <Card className="border-border/80 shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    Students by school
                  </CardTitle>
                  <CardDescription>Top schools by record count</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {data.students.bySchool.map((row) => (
                    <div key={row.school} className="space-y-1">
                      <div className="flex items-center justify-between text-sm gap-2">
                        <span className="truncate font-medium">{row.school}</span>
                        <span className="tabular-nums text-muted-foreground shrink-0">
                          {row.count.toLocaleString()}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary/80"
                          style={{ width: `${Math.max(4, (row.count / maxSchool) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card className="border-border/80 shadow-none">
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
                      <LineChart className="h-4 w-4" />
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
