'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import AdminHeader from '@/components/AdminHeader';
import {
  Users, GitMerge, CheckCheck, X, RefreshCw, Loader2,
  AlertTriangle, ChevronRight, Info, MapPin,
  ArrowLeft,
} from 'lucide-react';
import {
  addressMatchHint,
  addressMatchLabel,
  type AddressMatchKind,
} from '@/lib/addressDuplicate';
import { formatStudentAddressStacked } from '@/lib/addressValidation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

interface AddressComparison {
  match: AddressMatchKind;
  flaggedDisplay?: string | null;
  matchDisplay?: string | null;
  flaggedVerified?: boolean;
  matchVerified?: boolean;
  label?: string;
  hint?: string;
  addressDriven?: boolean;
}

interface StudentRecord {
  _id: string;
  firstName: string;
  lastName: string;
  dob: string;
  school?: string;
  labelId?: string;
  studentId?: string;
  email?: string;
  phone?: string;
  gender?: string;
  program?: string;
  status?: string;
  cabinet?: string;
  drawer?: string;
  createdAt?: string;
  siblingFlag?: boolean;
  siblingConfirmed?: boolean;
  address?: string;
  apt?: string;
  city?: string;
  state?: string;
  zip?: string;
  addressValidationStatus?: string;
  addressComparison?: AddressComparison;
}

interface DuplicatePair {
  flagged: StudentRecord;
  matches: StudentRecord[];
}

interface DuplicatesResponse {
  flagged: DuplicatePair[];
  autoDetected: DuplicatePair[];
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="text-sm">
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function addressMatchBadgeClass(match?: AddressMatchKind): string {
  switch (match) {
    case 'same_verified':
      return 'bg-green-100 text-green-800 border-green-300';
    case 'same':
    case 'similar':
      return 'bg-emerald-50 text-emerald-800 border-emerald-300';
    case 'different':
      return 'bg-sky-50 text-sky-800 border-sky-300';
    case 'incoming_missing':
    case 'existing_missing':
    case 'both_missing':
      return 'bg-amber-50 text-amber-800 border-amber-300';
    default:
      return 'bg-slate-50 text-slate-600 border-slate-300';
  }
}

function AddressBlock({ student }: { student: Pick<StudentRecord, 'address' | 'apt' | 'city' | 'state' | 'zip' | 'addressValidationStatus'> }) {
  const stacked = formatStudentAddressStacked(student);
  if (!stacked?.streetLine && !stacked?.cityStateZip) {
    return (
      <div className="text-sm text-muted-foreground flex items-center gap-1">
        <MapPin className="h-3 w-3 shrink-0" />
        <span>Address: —</span>
      </div>
    );
  }

  return (
    <div className="text-sm space-y-0.5">
      <div className="flex items-center gap-1 text-muted-foreground">
        <MapPin className="h-3 w-3 shrink-0" />
        <span>Address</span>
        {student.addressValidationStatus === 'verified' && (
          <Badge variant="outline" className="text-[9px] h-4 px-1 bg-green-50 text-green-700 border-green-300">
            Verified
          </Badge>
        )}
      </div>
      {stacked.streetLine && (
        <div className="font-medium text-foreground pl-4">{stacked.streetLine}</div>
      )}
      {stacked.cityStateZip && (
        <div className="text-xs text-muted-foreground pl-4">{stacked.cityStateZip}</div>
      )}
    </div>
  );
}

function AddressComparisonBlock({ comparison }: { comparison: AddressComparison }) {
  return (
    <div className="rounded-md border border-dashed bg-muted/40 px-3 py-2.5 text-xs space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge
          variant="outline"
          title={comparison.hint || addressMatchHint(comparison.match)}
          className={`text-[10px] ${addressMatchBadgeClass(comparison.match)}`}
        >
          {comparison.label || addressMatchLabel(comparison.match)}
        </Badge>
        {comparison.addressDriven && (
          <Badge variant="outline" className="text-[10px]">Matched by address</Badge>
        )}
        {(comparison.flaggedVerified || comparison.matchVerified) && (
          <span className="text-[10px] text-muted-foreground">NYC verified on file</span>
        )}
      </div>
      {comparison.flaggedDisplay && (
        <p className="text-muted-foreground">
          <span className="text-foreground/80">Record A:</span> {comparison.flaggedDisplay}
        </p>
      )}
      {comparison.matchDisplay && (
        <p className="text-muted-foreground">
          <span className="text-foreground/80">Record B:</span> {comparison.matchDisplay}
        </p>
      )}
      {comparison.match === 'different' && (
        <p className="text-[10px] text-sky-700 dark:text-sky-300 italic">
          Addresses differ — may be siblings at different homes, or one student may have moved.
        </p>
      )}
      {comparison.match === 'similar' && (
        <p className="text-[10px] text-emerald-700 dark:text-emerald-300 italic">
          Same building — likely siblings in different apartments.
        </p>
      )}
    </div>
  );
}

function StudentCard({
  student,
  role,
  isPrimary,
  onSetPrimary,
}: {
  student: StudentRecord;
  role: 'flagged' | 'match';
  isPrimary: boolean;
  onSetPrimary?: () => void;
}) {
  return (
    <div
      className={`rounded-lg border p-4 flex flex-col gap-2 transition-all ${
        isPrimary
          ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/20 ring-2 ring-blue-300'
          : 'border-border bg-card'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-base">
            {student.firstName} {student.lastName}
          </p>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">
            {student.labelId || student.studentId || '—'}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Badge variant={role === 'flagged' ? 'destructive' : 'outline'} className="text-xs">
            {role === 'flagged' ? 'Flagged' : 'Match'}
          </Badge>
          {student.siblingConfirmed && (
            <Badge variant="outline" className="text-xs border-green-400 text-green-700">
              Confirmed sibling
            </Badge>
          )}
        </div>
      </div>

      <Separator />

      <div className="space-y-1">
        <Field label="DOB"      value={student.dob} />
        <Field label="School"   value={student.school} />
        <AddressBlock student={student} />
        <Field label="Email"    value={student.email} />
        <Field label="Phone"    value={student.phone} />
        <Field label="Program"  value={student.program} />
        <Field label="Status"   value={student.status} />
        <Field label="Registered" value={student.createdAt
          ? new Date(student.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
          : undefined} />
      </div>

      {onSetPrimary && (
        <Button
          variant={isPrimary ? 'default' : 'outline'}
          size="sm"
          className="mt-1 w-full gap-1.5"
          onClick={onSetPrimary}
        >
          {isPrimary ? <CheckCheck size={14} /> : <ChevronRight size={14} />}
          {isPrimary ? 'Keep this record (primary)' : 'Set as primary'}
        </Button>
      )}
    </div>
  );
}

function PairCard({
  flagged,
  matches,
  actioning,
  isAuto = false,
  onConfirm,
  onMerge,
  onDismiss,
}: {
  flagged: StudentRecord;
  matches: StudentRecord[];
  actioning: boolean;
  isAuto?: boolean;
  onConfirm: (flaggedId: string, matchId: string) => void;
  onMerge: (pair: DuplicatePair, matchIdx: number) => void;
  onDismiss: (flaggedId: string, matchId?: string) => void;
}) {
  return (
    <Card className={isAuto
      ? 'border-blue-200 dark:border-blue-800'
      : 'border-amber-200 dark:border-amber-800'
    }>
      <CardHeader className="pb-3">
        <CardTitle className={`flex items-center gap-2 text-sm font-semibold ${
          isAuto ? 'text-blue-700 dark:text-blue-400' : 'text-amber-700 dark:text-amber-400'
        }`}>
          {isAuto ? <Users className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {flagged.firstName} {flagged.lastName}
          <span className="font-normal text-muted-foreground">
            · DOB {flagged.dob}{flagged.school && ` · ${flagged.school}`}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {matches.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            No similar records found. Flag may have been set manually.
          </p>
        ) : (
          matches.map((match, matchIdx) => (
            <div key={match._id} className="space-y-3">
              {matchIdx > 0 && <Separator />}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <StudentCard student={flagged} role={isAuto ? 'match' : 'flagged'} isPrimary={false} />
                <StudentCard student={match} role="match" isPrimary={false} />
              </div>
              {match.addressComparison && (
                <AddressComparisonBlock comparison={match.addressComparison} />
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" variant="outline"
                  className="gap-1.5 border-green-400 text-green-700 hover:bg-green-50 dark:hover:bg-green-950/20"
                  disabled={actioning}
                  onClick={() => onConfirm(flagged._id, match._id)}
                >
                  <CheckCheck size={14} /> Confirm Siblings
                </Button>
                <Button size="sm"
                  className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={actioning}
                  onClick={() => onMerge({ flagged, matches }, matchIdx)}
                >
                  <GitMerge size={14} /> Merge Records
                </Button>
                <Button size="sm" variant="ghost"
                  className="gap-1.5 text-muted-foreground hover:text-foreground"
                  disabled={actioning}
                  onClick={() => onDismiss(flagged._id, match._id)}
                >
                  <X size={14} /> {isAuto ? 'Not a duplicate' : 'Dismiss Flag'}
                </Button>
              </div>
            </div>
          ))
        )}
        {matches.length === 0 && (
          <Button size="sm" variant="ghost"
            className="gap-1.5 text-muted-foreground hover:text-foreground"
            disabled={actioning}
            onClick={() => onDismiss(flagged._id)}
          >
            <X size={14} /> Dismiss Flag
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function DuplicatesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = (session?.user as any)?.role;

  const [flaggedPairs, setFlaggedPairs] = useState<DuplicatePair[]>([]);
  const [autoPairs, setAutoPairs] = useState<DuplicatePair[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Merge dialog state
  const [mergeDialog, setMergeDialog] = useState<{
    pair: DuplicatePair;
    matchIndex: number;
    primaryId: string;
  } | null>(null);
  const [actioning, setActioning] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) { router.push('/auth/signin'); return; }
    if (!['Admin', 'Data Lead'].includes(role)) { router.push('/'); return; }
    load();
  }, [session, status, role, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/duplicates');
      if (!res.ok) throw new Error('Failed to fetch');
      const data: DuplicatesResponse = await res.json();
      setFlaggedPairs(data.flagged || []);
      setAutoPairs(data.autoDetected || []);
    } catch {
      setError('Failed to load duplicate pairs.');
    } finally {
      setLoading(false);
    }
  }, []);

  async function doAction(
    action: 'dismiss' | 'confirm_siblings' | 'merge',
    primaryId: string,
    secondaryId?: string,
  ) {
    setActioning(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/admin/duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, primaryId, secondaryId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');

      const labels: Record<string, string> = {
        dismiss: 'Flag dismissed — record marked as reviewed.',
        confirm_siblings: 'Confirmed as siblings — both records kept and updated.',
        merge: 'Records merged — secondary record deleted.',
      };
      setSuccess(labels[action] || 'Done.');
      setMergeDialog(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setActioning(false);
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-background">
        <AdminHeader />
        <div className="w-full p-6 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <div className="w-full p-6 space-y-6">

        {/* Back button */}
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Button>

        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Users className="h-8 w-8" />
              Duplicate Review
            </h1>
            <p className="text-muted-foreground mt-1">
              Students flagged as possible siblings or duplicates by intake staff.
              Review each pair and confirm, merge, or dismiss.
            </p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="border-green-300 bg-green-50 dark:bg-green-950/20">
            <CheckCheck className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 dark:text-green-300">{success}</AlertDescription>
          </Alert>
        )}

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Confirm Siblings</strong> — keeps both records and marks them as confirmed siblings. &nbsp;
            <strong>Merge</strong> — choose which record to keep; the other is deleted and its drawer space freed. &nbsp;
            <strong>Dismiss</strong> — clears the flag; treats them as unrelated people. &nbsp;
            Home addresses are compared using NYC-standardized data when available — same address strengthens the match; different addresses may indicate siblings or a move.
          </AlertDescription>
        </Alert>

        {/* Empty state */}
        {flaggedPairs.length === 0 && autoPairs.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <CheckCheck className="h-12 w-12 text-green-500" />
              <p className="text-lg font-semibold">No duplicates found</p>
              <p className="text-sm text-muted-foreground">
                No flagged records and no similar-looking students detected.
              </p>
            </CardContent>
          </Card>
        )}

        {/* ── Manually flagged by intake staff ── */}
        {flaggedPairs.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <h2 className="text-lg font-semibold">Flagged by Intake Staff</h2>
              <Badge variant="outline" className="text-xs">{flaggedPairs.length}</Badge>
            </div>
            {flaggedPairs.map(({ flagged, matches }) => (
              <PairCard
                key={flagged._id}
                flagged={flagged}
                matches={matches}
                actioning={actioning}
                onConfirm={(fId, mId) => doAction('confirm_siblings', fId, mId)}
                onMerge={(pair, matchIdx) =>
                  setMergeDialog({ pair, matchIndex: matchIdx, primaryId: pair.flagged._id })
                }
                onDismiss={(fId, mId) => doAction('dismiss', fId, mId)}
              />
            ))}
          </div>
        )}

        {/* ── Auto-detected by the system ── */}
        {autoPairs.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              <h2 className="text-lg font-semibold">Auto-Detected Similar Records</h2>
              <Badge variant="outline" className="text-xs">{autoPairs.length}</Badge>
              <span className="text-xs text-muted-foreground">— same DOB + similar name or same address, not yet reviewed</span>
            </div>
            {autoPairs.map(({ flagged, matches }) => (
              <PairCard
                key={flagged._id}
                flagged={flagged}
                matches={matches}
                actioning={actioning}
                isAuto
                onConfirm={(fId, mId) => doAction('confirm_siblings', fId, mId)}
                onMerge={(pair, matchIdx) =>
                  setMergeDialog({ pair, matchIndex: matchIdx, primaryId: pair.flagged._id })
                }
                onDismiss={(fId, mId) => doAction('dismiss', fId, mId)}
              />
            ))}
          </div>
        )}

      </div>

      {/* Merge dialog — pick which record to keep */}
      <Dialog open={!!mergeDialog} onOpenChange={(open) => { if (!open) setMergeDialog(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitMerge className="h-5 w-5 text-blue-600" /> Merge Records
            </DialogTitle>
            <DialogDescription>
              Select which record to <strong>keep</strong> as the primary.
              All data will be preserved on the primary. The other record will be permanently deleted
              and its drawer space freed.
            </DialogDescription>
          </DialogHeader>

          {mergeDialog && (() => {
            const { pair, matchIndex, primaryId } = mergeDialog;
            const match = pair.matches[matchIndex];
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <StudentCard
                    student={pair.flagged}
                    role="flagged"
                    isPrimary={primaryId === pair.flagged._id}
                    onSetPrimary={() => setMergeDialog(d => d ? { ...d, primaryId: pair.flagged._id } : d)}
                  />
                  <StudentCard
                    student={match}
                    role="match"
                    isPrimary={primaryId === match._id}
                    onSetPrimary={() => setMergeDialog(d => d ? { ...d, primaryId: match._id } : d)}
                  />
                </div>

                <Alert variant="destructive" className="text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    The <strong>non-primary</strong> record will be <strong>permanently deleted</strong>.
                    Any fields missing on the primary will be copied from the deleted record first.
                  </AlertDescription>
                </Alert>
              </div>
            );
          })()}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setMergeDialog(null)} disabled={actioning}>
              Cancel
            </Button>
            <Button
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              disabled={actioning}
              onClick={() => {
                if (!mergeDialog) return;
                const match = mergeDialog.pair.matches[mergeDialog.matchIndex];
                const secondaryId = mergeDialog.primaryId === mergeDialog.pair.flagged._id
                  ? match._id
                  : mergeDialog.pair.flagged._id;
                doAction('merge', mergeDialog.primaryId, secondaryId);
              }}
            >
              {actioning && <Loader2 size={14} className="animate-spin" />}
              <GitMerge size={14} />
              Merge & Delete Secondary
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
