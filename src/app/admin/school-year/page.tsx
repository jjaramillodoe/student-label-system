'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import AdminHeader from '@/components/AdminHeader';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarRange,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Shield,
} from 'lucide-react';

type ChecklistItem = {
  id: string;
  title: string;
  description: string;
  status: 'complete' | 'warning' | 'action';
  href?: string;
  detail?: string;
};

type RolloverData = {
  school: string | null;
  systemFiscalYear: string;
  configuredFiscalYear: string;
  summary: {
    activeCabinets: number;
    archivedCabinets: number;
    fullActiveCabinets: number;
    openActiveCabinets: number;
    pendingArchiveAssignments: number;
    activeStudentsWithoutDrawer: number;
    checklistComplete: number;
    checklistTotal: number;
  };
  checklist: ChecklistItem[];
};

function StatusBadge({ status }: { status: ChecklistItem['status'] }) {
  if (status === 'complete') {
    return <Badge className="bg-green-600 hover:bg-green-600">Ready</Badge>;
  }
  if (status === 'warning') {
    return <Badge variant="secondary">Review</Badge>;
  }
  return <Badge variant="destructive">Action needed</Badge>;
}

export default function SchoolYearPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const userRole = (session?.user as { role?: string } | undefined)?.role;
  const [data, setData] = useState<RolloverData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/school-year');
      const json = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) {
        throw new Error('Sign in as Admin or Data Lead to view the school year rollover checklist.');
      }
      if (!res.ok) throw new Error(json.error || 'Failed to load rollover checklist');
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rollover checklist');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }
    if (userRole && userRole !== 'Admin' && userRole !== 'Data Lead') {
      router.push('/');
      return;
    }
    load();
  }, [status, userRole, router]);

  const allReady = Boolean(
    data && data.summary.checklistComplete === data.summary.checklistTotal,
  );

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <div className="w-full p-6 space-y-6">
        <Button variant="outline" asChild>
          <Link href="/admin/cabinets">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Cabinets
          </Link>
        </Button>

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <CalendarRange className="h-8 w-8" />
              School Year Rollover
            </h1>
            <p className="text-muted-foreground mt-1 max-w-3xl">
              Use this checklist when closing one school year and starting the next.
              Archive old files into boxes, then open a fresh active cabinet for new intake.
            </p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading && !data ? (
          <Card>
            <CardContent className="py-12 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Loading rollover status...
            </CardContent>
          </Card>
        ) : data && (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Intake Year</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.configuredFiscalYear}</div>
                  {data.configuredFiscalYear !== data.systemFiscalYear && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Calendar default: {data.systemFiscalYear}
                    </p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Active Cabinets</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.summary.openActiveCabinets}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    with space · {data.summary.activeCabinets} total active
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Archived</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.summary.archivedCabinets}</div>
                  <p className="text-xs text-muted-foreground mt-1">closed cabinets in boxes</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Checklist</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {data.summary.checklistComplete}/{data.summary.checklistTotal}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">steps ready</p>
                </CardContent>
              </Card>
            </div>

            {allReady ? (
              <Alert className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800 dark:text-green-200">Ready for the new school year</AlertTitle>
                <AlertDescription className="text-green-700 dark:text-green-300">
                  Intake can assign new and returning students to active drawers. Archived files stay in boxes for lookup.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Complete the steps below before peak intake</AlertTitle>
                <AlertDescription>
                  Returning students who are still in archive boxes keep their box location in Intake
                  (no new drawer). Active returning students keep their existing cabinet/drawer.
                </AlertDescription>
              </Alert>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Rollover Checklist</CardTitle>
                <CardDescription>
                  {data.school ? `School: ${data.school}` : 'All schools (Admin view)'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {data.checklist.map((item, index) => (
                  <div
                    key={item.id}
                    className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 rounded-lg border p-4"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-muted-foreground">
                          {index + 1}.
                        </span>
                        <h3 className="font-semibold">{item.title}</h3>
                        <StatusBadge status={item.status} />
                      </div>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                      {item.detail && (
                        <p className="text-sm">{item.detail}</p>
                      )}
                    </div>
                    {item.href && (
                      <Button asChild variant="outline" size="sm" className="shrink-0 gap-1">
                        <Link href={item.href}>
                          Open
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
                  <Shield className="h-5 w-5" />
                  Physical file retention (7 years)
                </CardTitle>
                <CardDescription className="text-amber-800/80 dark:text-amber-300/80">
                  Adult education programs must keep physical student file copies for at least seven years.
                  Archiving supports that requirement — it is not the same as deleting records.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-amber-950/90 dark:text-amber-100/90 space-y-3">
                <ul className="list-disc pl-5 space-y-2">
                  <li>
                    <strong className="text-foreground">Always archive at end of year</strong> when the school year closes — even if drawers are not full.
                    Turn on <strong className="text-foreground">End-of-year closeout</strong> on the Archive dialog to close a partially filled cabinet.
                  </li>
                  <li>
                    <strong className="text-foreground">Keep the physical boxes</strong> in their assigned location (e.g. storage room) with QR labels attached.
                    The system tracks which box each student file is in for lookup and audits.
                  </li>
                  <li>
                    <strong className="text-foreground">Do not delete archived cabinets or student records</strong> in this system until your program&apos;s retention policy allows disposal — typically not before seven years from the file date.
                  </li>
                  <li>
                    Each school year adds another archived cabinet and set of boxes (2025–2026, 2026–2027, etc.).
                    That stack of labeled boxes <em>is</em> your multi-year retention; active drawers are only for the current year&apos;s working files.
                  </li>
                </ul>
                <p className="text-xs text-muted-foreground pt-1 border-t border-amber-200/60 dark:border-amber-800/40">
                  This app does not automatically purge archived files. Disposal after the retention period should follow your site&apos;s written records policy and be done deliberately — not as part of normal school-year rollover.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>What happens during rollover</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  <strong className="text-foreground">End of year:</strong> Archive each cabinet for that year — full or not.
                  On a partially filled cabinet, enable <strong className="text-foreground">End-of-year closeout</strong> in the Archive dialog.
                  Student files move into labeled archive boxes; the cabinet is closed for new assignments.
                </p>
                <p>
                  <strong className="text-foreground">Start of year:</strong> Create a new active cabinet (e.g. Main Cabinet M–P).
                  Set the fiscal year in School Settings so intake uses 2026–2027.
                </p>
                <p>
                  <strong className="text-foreground">Returning students:</strong> When found on intake, archived students
                  automatically get the next open drawer in an active cabinet and their old archive box location is kept in history.
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
