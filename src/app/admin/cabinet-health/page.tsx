'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Archive, Building2, CheckCircle2, Loader2, RefreshCw, ShieldAlert, Wrench } from 'lucide-react';
import PageIntro from '@/components/PageIntro';
import FixStudentAssignmentDialog from '@/components/FixStudentAssignmentDialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type CabinetHealth = {
  summary: {
    cabinets: number;
    archivedCabinets?: number;
    drawers: number;
    fullDrawers: number;
    nearFullDrawers: number;
    emptyDrawers: number;
    overCapacityCabinets: number;
    badAssignments: number;
  };
  fullDrawers: DrawerHealth[];
  nearFullDrawers: DrawerHealth[];
  emptyDrawers: DrawerHealth[];
  overCapacityCabinets: {
    cabinetId: string;
    cabinetName: string;
    school?: string;
    currentCount: number;
    totalCapacity: number;
    overBy: number;
    usagePercent: number;
  }[];
  badAssignments: {
    studentId: string;
    studentNumber?: string;
    studentName: string;
    school?: string;
    cabinet?: string;
    drawer?: string;
    reason: string;
  }[];
};

type DrawerHealth = {
  cabinetId: string;
  cabinetName: string;
  school?: string;
  drawerId?: string;
  drawerName: string;
  currentCount: number;
  capacity: number;
  usagePercent: number;
  available: number;
};

function UsageBadge({ percent }: { percent: number }) {
  if (percent >= 100) return <Badge variant="destructive">{percent}%</Badge>;
  if (percent >= 80) return <Badge variant="secondary">{percent}%</Badge>;
  return <Badge variant="outline">{percent}%</Badge>;
}

function DrawerTable({ drawers, emptyLabel }: { drawers: DrawerHealth[]; emptyLabel: string }) {
  if (drawers.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="rounded-md border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cabinet</TableHead>
            <TableHead>Drawer</TableHead>
            <TableHead>School</TableHead>
            <TableHead>Usage</TableHead>
            <TableHead className="text-right">Available</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {drawers.map((drawer) => (
            <TableRow key={`${drawer.cabinetId}-${drawer.drawerId}`}>
              <TableCell className="font-medium">{drawer.cabinetName}</TableCell>
              <TableCell>{drawer.drawerName}</TableCell>
              <TableCell className="text-muted-foreground">{drawer.school || '-'}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <UsageBadge percent={drawer.usagePercent} />
                  <span className="text-sm text-muted-foreground">
                    {drawer.currentCount}/{drawer.capacity}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-right">{drawer.available}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function CabinetHealthPage() {
  const [health, setHealth] = useState<CabinetHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fixAssignment, setFixAssignment] = useState<CabinetHealth['badAssignments'][number] | null>(null);

  useEffect(() => {
    fetchHealth();
  }, []);

  async function fetchHealth() {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/cabinet-health');
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load cabinet health');
      }

      setHealth(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cabinet health');
    } finally {
      setLoading(false);
    }
  }

  const hasIssues = Boolean(
    health && (
      health.summary.fullDrawers > 0 ||
      health.summary.nearFullDrawers > 0 ||
      health.summary.overCapacityCabinets > 0 ||
      health.summary.badAssignments > 0
    )
  );

  return (
    <div className="w-full space-y-6">

      <PageIntro
        eyebrow="Storage"
        title="Cabinet Health"
        description="Review active cabinet storage, empty drawers, over-capacity cabinets, and bad assignments. Archived cabinets use archive boxes on the Cabinets page."
        icon={<ShieldAlert className="h-5 w-5 text-primary" />}
        actions={
          <>
            <Button variant="outline" onClick={fetchHealth} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </Button>
            <Button asChild>
              <Link href="/admin/cabinets">Manage Cabinets</Link>
            </Button>
          </>
        }
      />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && !health ? (
        <Card>
          <CardContent className="py-12 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            Loading cabinet health...
          </CardContent>
        </Card>
      ) : health && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Cabinets</p>
                  <p className="text-2xl font-bold">{health.summary.cabinets}</p>
                  {(health.summary.archivedCabinets ?? 0) > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {health.summary.archivedCabinets} archived (boxes only)
                    </p>
                  )}
                </div>
                <Archive className="h-8 w-8 text-muted-foreground" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Drawers</p>
                  <p className="text-2xl font-bold">{health.summary.drawers}</p>
                </div>
                <Building2 className="h-8 w-8 text-muted-foreground" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Capacity Warnings</p>
                  <p className={`text-2xl font-bold ${health.summary.overCapacityCabinets > 0 ? 'text-destructive' : ''}`}>
                    {health.summary.fullDrawers + health.summary.nearFullDrawers + health.summary.overCapacityCabinets}
                  </p>
                </div>
                <ShieldAlert className="h-8 w-8 text-muted-foreground" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Bad Assignments</p>
                  <p className={`text-2xl font-bold ${health.summary.badAssignments > 0 ? 'text-destructive' : ''}`}>
                    {health.summary.badAssignments}
                  </p>
                </div>
                <AlertCircle className="h-8 w-8 text-muted-foreground" />
              </CardContent>
            </Card>
          </div>

          {!hasIssues && (
            <Alert className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertTitle className="text-green-800 dark:text-green-200">Cabinets look healthy</AlertTitle>
              <AlertDescription className="text-green-700 dark:text-green-300">
                No full drawers, over-capacity cabinets, or bad assignments were found.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Over-Capacity Cabinets</CardTitle>
                <CardDescription>Cabinets with more assigned files than total capacity.</CardDescription>
              </CardHeader>
              <CardContent>
                {health.overCapacityCabinets.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No over-capacity cabinets.</p>
                ) : (
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cabinet</TableHead>
                          <TableHead>School</TableHead>
                          <TableHead>Usage</TableHead>
                          <TableHead className="text-right">Over By</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {health.overCapacityCabinets.map((cabinet) => (
                          <TableRow key={cabinet.cabinetId}>
                            <TableCell className="font-medium">{cabinet.cabinetName}</TableCell>
                            <TableCell className="text-muted-foreground">{cabinet.school || '-'}</TableCell>
                            <TableCell>
                              <UsageBadge percent={cabinet.usagePercent} />
                            </TableCell>
                            <TableCell className="text-right text-destructive font-medium">{cabinet.overBy}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Bad Assignments</CardTitle>
                <CardDescription>Students missing a valid cabinet or drawer assignment. Use Fix to reassign.</CardDescription>
              </CardHeader>
              <CardContent>
                {health.badAssignments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No bad assignments.</p>
                ) : (
                  <div className="rounded-md border overflow-hidden max-h-[420px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead>School</TableHead>
                          <TableHead>Issue</TableHead>
                          <TableHead className="text-right">Fix</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {health.badAssignments.map((assignment) => {
                          const needsArchive =
                            assignment.reason.toLowerCase().includes('archive');
                          return (
                            <TableRow key={assignment.studentId}>
                              <TableCell>
                                <div className="font-medium">{assignment.studentName}</div>
                                <div className="text-xs text-muted-foreground">{assignment.studentNumber || assignment.studentId}</div>
                              </TableCell>
                              <TableCell className="text-muted-foreground">{assignment.school || '-'}</TableCell>
                              <TableCell>
                                <Badge variant="destructive">{assignment.reason}</Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                {needsArchive ? (
                                  <Button size="sm" variant="ghost" asChild>
                                    <Link href="/admin/cabinets">Boxes</Link>
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1"
                                    onClick={() => setFixAssignment(assignment)}
                                  >
                                    <Wrench className="h-3.5 w-3.5" />
                                    Fix
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Full Drawers</CardTitle>
              <CardDescription>Drawers at or above capacity.</CardDescription>
            </CardHeader>
            <CardContent>
              <DrawerTable drawers={health.fullDrawers} emptyLabel="No full drawers." />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Near-Full Drawers</CardTitle>
              <CardDescription>Drawers at 80% to 99% usage.</CardDescription>
            </CardHeader>
            <CardContent>
              <DrawerTable drawers={health.nearFullDrawers} emptyLabel="No near-full drawers." />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Empty Drawers</CardTitle>
              <CardDescription>
                Available drawer space in active cabinets only. Archived cabinets show archive boxes on the Cabinets page instead.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DrawerTable drawers={health.emptyDrawers} emptyLabel="No empty drawers." />
            </CardContent>
          </Card>
        </>
      )}

      {success && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800 dark:text-green-200">Updated</AlertTitle>
          <AlertDescription className="text-green-700 dark:text-green-300">{success}</AlertDescription>
        </Alert>
      )}

      <FixStudentAssignmentDialog
        open={!!fixAssignment}
        onOpenChange={(open) => !open && setFixAssignment(null)}
        studentIds={fixAssignment ? [fixAssignment.studentId] : []}
        studentLabel={fixAssignment?.studentName}
        source="cabinet-health"
        onDone={(message) => {
          setSuccess(message);
          setError('');
          fetchHealth();
        }}
      />
    </div>
  );
}
