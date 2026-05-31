'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Building2, Printer, Activity, TrendingUp, Archive, FileText } from 'lucide-react';

interface DashboardStatsProps {
  refreshTrigger?: number;
}

export default function DashboardStats({ refreshTrigger }: DashboardStatsProps) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
    );
  }

  if (!stats) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Students</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.students?.total || 0}</div>
          <p className="text-xs text-muted-foreground">
            {stats.students?.active || 0} not archived, {stats.students?.archived || 0} archived
          </p>
          {stats.students?.activeStatus !== undefined && stats.students.activeStatus !== stats.students.active && (
            <p className="text-xs text-muted-foreground mt-1">
              ({stats.students.activeStatus} with "Active" status)
            </p>
          )}
          {stats.students?.newThisMonth > 0 && (
            <Badge variant="secondary" className="mt-2">
              +{stats.students.newThisMonth} this month
            </Badge>
          )}
        </CardContent>
      </Card>

      <Card>
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

      <Card>
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

      <Card>
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
    </div>
  );
}

