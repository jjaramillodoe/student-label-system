'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Users, Building2, Printer, Activity, ChevronDown, ChevronUp } from 'lucide-react';

interface DashboardStatsProps {
  refreshTrigger?: number;
  /** Start collapsed so search/print lead the page */
  defaultCollapsed?: boolean;
}

export default function DashboardStats({
  refreshTrigger,
  defaultCollapsed = true,
}: DashboardStatsProps) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  useEffect(() => {
    fetchStats();
  }, [refreshTrigger]);

  async function fetchStats() {
    try {
      setLoading(true);
      const res = await fetch('/api/dashboard-stats');
      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="mb-4">
        <Skeleton className="h-9 w-40 mb-2" />
        {!collapsed && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="mb-4">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="gap-2 mb-2 text-muted-foreground"
        onClick={() => setCollapsed(c => !c)}
      >
        {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        {collapsed ? 'Show overview stats' : 'Hide overview stats'}
      </Button>

      {!collapsed && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/admin/students/all" className="block transition-opacity hover:opacity-90">
            <Card className="h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Students</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.students?.total || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.students?.active || 0} not archived, {stats.students?.archived || 0} archived
                </p>
                {stats.students?.newThisMonth > 0 && (
                  <Badge variant="secondary" className="mt-2">
                    +{stats.students.newThisMonth} this month
                  </Badge>
                )}
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/cabinets" className="block transition-opacity hover:opacity-90">
            <Card className="h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Storage Utilization</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.cabinets?.utilizationPercent || 0}%</div>
                <p className="text-xs text-muted-foreground">
                  {stats.cabinets?.totalUsed || 0} / {stats.cabinets?.totalCapacity || 0} files
                </p>
                <div className="w-full bg-muted rounded-full h-2 mt-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      (stats.cabinets?.utilizationPercent || 0) >= 90
                        ? 'bg-destructive'
                        : (stats.cabinets?.utilizationPercent || 0) >= 70
                        ? 'bg-yellow-500'
                        : 'bg-primary'
                    }`}
                    style={{ width: `${Math.min(stats.cabinets?.utilizationPercent || 0, 100)}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/print-queue" className="block transition-opacity hover:opacity-90">
            <Card className="h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Recent Prints</CardTitle>
                <Printer className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.printing?.recentPrints || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.printing?.recentLabels || 0} labels (last 30 days)
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/audit" className="block transition-opacity hover:opacity-90">
            <Card className="h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.activity?.recentActivity || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Actions in last 7 days
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      )}
    </div>
  );
}
