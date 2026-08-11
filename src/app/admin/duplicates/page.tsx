'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import PageIntro from '@/components/PageIntro';
import {
  Users, GitMerge, CheckCheck, X, RefreshCw, Loader2,
  AlertTriangle, ChevronRight, Info, MapPin,
} from 'lucide-react';
import {
  addressMatchHint,
  addressMatchLabel,
  type AddressMatchKind,
} from '@/lib/addressDuplicate';
import { formatStudentAddressStacked } from '@/lib/addressValidation';
import { formatFullName } from '@/lib/personName';
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
import UndoSnackbar from '@/components/UndoSnackbar';
import MergeFieldReview from '@/components/MergeFieldReview';
import {
  buildDefaultFieldChoices,
  buildMergeFieldDiff,
  canTransferDrawer,
  completenessScore,
  primaryQualityWarnings,
  type AppliedFieldChange,
  type MergeFieldChoices,
  type MergeSource,
} from '@/lib/mergeFields';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

const MERGE_UNDO_MS = 60_000;

type MergeUndoPayload = {
  primaryId: string;
  secondary: Record<string, unknown> & { _id: string };
  filledFields: string[];
  changes: AppliedFieldChange[];
  drawerTransferred?: boolean;
  historyId?: string;
};

type RecentMerge = {
  _id: string;
  at: string;
  byEmail: string;
  byName: string;
  school: string;
  primaryId: string;
  primaryName: string;
  secondaryId: string;
  secondaryName: string;
  fieldCount: number;
  drawerTransferred: boolean;
  canUndo: boolean;
  undoRemainingMs: number;
};

function collectSameBuildingPairs(pairs: DuplicatePair[]): Array<{ primaryId: string; secondaryId: string }> {
  const out: Array<{ primaryId: string; secondaryId: string }> = [];
  const seen = new Set<string>();
  for (const { flagged, matches } of pairs) {
    for (const match of matches) {
      if (match.addressComparison?.match !== 'similar') continue;
      const key = [flagged._id, match._id].sort().join(':');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ primaryId: flagged._id, secondaryId: match._id });
    }
  }
  return out;
}

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
  notes?: string;
  fiscalYear?: string;
  startDate?: string;
  status?: string;
  cabinet?: string;
  drawer?: string;
  drawerSection?: string;
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
    case 'same':
    case 'similar':
      return 'ui-badge-success';
    case 'different':
      return 'ui-badge-info';
    case 'incoming_missing':
    case 'existing_missing':
    case 'both_missing':
      return 'ui-badge-warning';
    default:
      return 'ui-badge-muted';
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
          <span className="ui-badge-success text-[9px]">Verified</span>
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
        <span
          title={comparison.hint || addressMatchHint(comparison.match)}
          className={`${addressMatchBadgeClass(comparison.match)} text-[10px]`}
        >
          {comparison.label || addressMatchLabel(comparison.match)}
        </span>
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
  completenessHint,
  showCompleteness = false,
}: {
  student: StudentRecord;
  role: 'flagged' | 'match';
  isPrimary: boolean;
  onSetPrimary?: () => void;
  completenessHint?: 'more' | 'less' | 'tie' | null;
  showCompleteness?: boolean;
}) {
  const score = completenessScore(student as unknown as Record<string, unknown>);
  const location =
    student.cabinet && student.drawer
      ? `Drawer ${student.drawer}${student.drawerSection ? ` · ${student.drawerSection}` : ''}`
      : undefined;

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
            {formatFullName(student)}
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
            <span className="ui-badge-success text-xs">
              Confirmed sibling
            </span>
          )}
          {showCompleteness && (
            <span
              className={`text-[10px] ${
                completenessHint === 'more'
                  ? 'ui-badge-success'
                  : completenessHint === 'less'
                    ? 'ui-badge-muted'
                    : 'ui-badge-muted'
              }`}
              title="Filled contact and address fields"
            >
              {score.filled}/{score.total} fields
              {completenessHint === 'more' ? ' · more complete' : ''}
            </span>
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
        <Field label="Gender"   value={student.gender} />
        <Field label="Program"  value={student.program} />
        <Field label="Notes"    value={student.notes} />
        <Field label="Fiscal year" value={student.fiscalYear} />
        <Field label="Start date" value={student.startDate} />
        <Field label="Location" value={location || 'Unassigned'} />
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
          {formatFullName(flagged)}
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
  const [recentMerges, setRecentMerges] = useState<RecentMerge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Merge dialog state
  const [mergeDialog, setMergeDialog] = useState<{
    pair: DuplicatePair;
    matchIndex: number;
    primaryId: string;
  } | null>(null);
  const [fieldChoices, setFieldChoices] = useState<MergeFieldChoices>({});
  const [transferDrawer, setTransferDrawer] = useState(true);
  const [actioning, setActioning] = useState(false);
  const [mergeUndo, setMergeUndo] = useState<MergeUndoPayload | null>(null);
  const [showMergeUndo, setShowMergeUndo] = useState(false);
  const [mergeUndoTimer, setMergeUndoTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Rebuild default field choices whenever primary selection changes
  useEffect(() => {
    if (!mergeDialog) {
      setFieldChoices({});
      setTransferDrawer(true);
      return;
    }
    const match = mergeDialog.pair.matches[mergeDialog.matchIndex];
    if (!match) return;
    const primary =
      mergeDialog.primaryId === mergeDialog.pair.flagged._id
        ? mergeDialog.pair.flagged
        : match;
    const secondary =
      mergeDialog.primaryId === mergeDialog.pair.flagged._id
        ? match
        : mergeDialog.pair.flagged;
    const pRec = primary as unknown as Record<string, unknown>;
    const sRec = secondary as unknown as Record<string, unknown>;
    setFieldChoices(buildDefaultFieldChoices(pRec, sRec));
    setTransferDrawer(canTransferDrawer(pRec, sRec));
  }, [mergeDialog?.primaryId, mergeDialog?.matchIndex, mergeDialog?.pair.flagged._id]);

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
      const data = await res.json();
      setFlaggedPairs(data.flagged || []);
      setAutoPairs(data.autoDetected || []);
      setRecentMerges(data.recentMerges || []);
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
    mergeChoices?: MergeFieldChoices,
    mergeTransferDrawer?: boolean,
  ) {
    setActioning(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/admin/duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          primaryId,
          secondaryId,
          ...(action === 'merge' && mergeChoices ? { fieldChoices: mergeChoices } : {}),
          ...(action === 'merge' ? { transferDrawer: Boolean(mergeTransferDrawer) } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');

      const labels: Record<string, string> = {
        dismiss: 'Flag dismissed — record marked as reviewed.',
        confirm_siblings: 'Confirmed as siblings — both records kept and updated.',
        merge: 'Records merged — secondary record deleted. You can undo for a few seconds.',
      };
      setSuccess(labels[action] || 'Done.');
      setMergeDialog(null);

      if (action === 'merge' && data.undo?.secondary) {
        if (mergeUndoTimer) clearTimeout(mergeUndoTimer);
        setMergeUndo({
          primaryId: data.undo.primaryId || primaryId,
          secondary: data.undo.secondary,
          filledFields: Array.isArray(data.undo.filledFields) ? data.undo.filledFields : [],
          changes: Array.isArray(data.undo.changes) ? data.undo.changes : [],
          drawerTransferred: Boolean(data.undo.drawerTransferred),
          historyId: data.undo.historyId ? String(data.undo.historyId) : undefined,
        });
        setShowMergeUndo(true);
        const timer = setTimeout(() => {
          setShowMergeUndo(false);
          setMergeUndo(null);
          setMergeUndoTimer(null);
        }, MERGE_UNDO_MS);
        setMergeUndoTimer(timer);
      }

      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setActioning(false);
    }
  }

  async function handleUndoMerge(historyId?: string) {
    const fromHistory = Boolean(historyId);
    if (!fromHistory && !mergeUndo) return;
    setActioning(true);
    setError('');
    try {
      const res = await fetch('/api/admin/duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          fromHistory
            ? { action: 'undo_merge', historyId }
            : {
                action: 'undo_merge',
                primaryId: mergeUndo!.primaryId,
                secondary: mergeUndo!.secondary,
                filledFields: mergeUndo!.filledFields,
                changes: mergeUndo!.changes,
                drawerTransferred: mergeUndo!.drawerTransferred,
                historyId: mergeUndo!.historyId,
              },
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Undo failed');
      if (mergeUndoTimer) clearTimeout(mergeUndoTimer);
      setShowMergeUndo(false);
      setMergeUndo(null);
      setMergeUndoTimer(null);
      setSuccess('Merge undone — secondary record restored.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Undo failed.');
    } finally {
      setActioning(false);
    }
  }

  async function handleBulkSameBuilding(action: 'bulk_confirm_siblings' | 'bulk_dismiss') {
    const pairs = collectSameBuildingPairs([...flaggedPairs, ...autoPairs]);
    if (pairs.length === 0) return;
    const label = action === 'bulk_confirm_siblings'
      ? `Confirm ${pairs.length} same-building pair(s) as siblings?`
      : `Dismiss ${pairs.length} same-building pair(s) as not duplicates?`;
    if (!confirm(label)) return;

    setActioning(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/admin/duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, pairs }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bulk action failed');
      setSuccess(
        action === 'bulk_confirm_siblings'
          ? `Confirmed ${data.processed} same-building pair(s) as siblings.`
          : `Dismissed ${data.processed} same-building pair(s).`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk action failed.');
    } finally {
      setActioning(false);
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="w-full space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-xl" />
          ))}
        </div>
    );
  }

  return (
    <div className="w-full space-y-6">
        <PageIntro
          eyebrow="Students"
          title="Duplicate Review"
          description="Students flagged as possible siblings or duplicates by intake staff. Review each pair and confirm, merge, or dismiss."
          icon={<Users className="h-5 w-5 text-primary" />}
          actions={
            <Button variant="outline" onClick={load} disabled={loading} className="gap-2">
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
          }
        />

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
            <strong>Merge</strong> — choose which record to keep, then pick which fields to keep when values differ; the other record is deleted (undo ~60 seconds in the snackbar, or up to 15 minutes from Recent merges). &nbsp;
            <strong>Dismiss</strong> — clears the flag; treats them as unrelated people. &nbsp;
            Home addresses are compared using NYC-standardized data when available — same address strengthens the match; different addresses may indicate siblings or a move.
          </AlertDescription>
        </Alert>

        {(() => {
          const sameBuilding = collectSameBuildingPairs([...flaggedPairs, ...autoPairs]);
          if (sameBuilding.length === 0) return null;
          return (
            <Alert className="border-emerald-300 bg-emerald-50/80 dark:bg-emerald-950/20">
              <Users className="h-4 w-4 text-emerald-700" />
              <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <span className="text-sm text-emerald-900 dark:text-emerald-200">
                  <strong>{sameBuilding.length}</strong> same-building pair
                  {sameBuilding.length === 1 ? '' : 's'} (likely siblings in different units).
                </span>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 border-green-400 text-green-700"
                    disabled={actioning}
                    onClick={() => void handleBulkSameBuilding('bulk_confirm_siblings')}
                  >
                    <CheckCheck size={14} /> Confirm all as siblings
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5"
                    disabled={actioning}
                    onClick={() => void handleBulkSameBuilding('bulk_dismiss')}
                  >
                    <X size={14} /> Dismiss all
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          );
        })()}

        {/* Empty state */}
        {flaggedPairs.length === 0 && autoPairs.length === 0 && recentMerges.length === 0 && (
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

      {/* Merge dialog — pick primary + which fields to keep */}
      <Dialog open={!!mergeDialog} onOpenChange={(open) => { if (!open) setMergeDialog(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitMerge className="h-5 w-5 text-blue-600" /> Merge Records
            </DialogTitle>
            <DialogDescription>
              1) Choose which student record to <strong>keep</strong> (primary).
              2) For each field below, pick the value to keep after verification.
              The other record is deleted — you can undo for about 10 seconds afterward.
            </DialogDescription>
          </DialogHeader>

          {mergeDialog && (() => {
            const { pair, matchIndex, primaryId } = mergeDialog;
            const match = pair.matches[matchIndex];
            const primaryStudent = primaryId === pair.flagged._id ? pair.flagged : match;
            const secondaryStudent = primaryId === pair.flagged._id ? match : pair.flagged;
            const pRec = primaryStudent as unknown as Record<string, unknown>;
            const sRec = secondaryStudent as unknown as Record<string, unknown>;
            const diffRows = buildMergeFieldDiff(pRec, sRec);
            const warnings = primaryQualityWarnings(pRec, sRec);
            const pScore = completenessScore(pRec);
            const sScore = completenessScore(sRec);
            const drawerEligible = canTransferDrawer(pRec, sRec);
            const completenessFor = (studentId: string) => {
              const isPrimaryCard = studentId === primaryId;
              const thisScore = isPrimaryCard ? pScore : sScore;
              const otherScore = isPrimaryCard ? sScore : pScore;
              if (thisScore.filled > otherScore.filled) return 'more' as const;
              if (thisScore.filled < otherScore.filled) return 'less' as const;
              return 'tie' as const;
            };
            const onChoice = (key: keyof MergeFieldChoices, source: MergeSource) => {
              setFieldChoices((prev) => ({ ...prev, [key]: source }));
            };
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <StudentCard
                    student={pair.flagged}
                    role="flagged"
                    isPrimary={primaryId === pair.flagged._id}
                    showCompleteness
                    completenessHint={completenessFor(pair.flagged._id)}
                    onSetPrimary={() => setMergeDialog(d => d ? { ...d, primaryId: pair.flagged._id } : d)}
                  />
                  <StudentCard
                    student={match}
                    role="match"
                    isPrimary={primaryId === match._id}
                    showCompleteness
                    completenessHint={completenessFor(match._id)}
                    onSetPrimary={() => setMergeDialog(d => d ? { ...d, primaryId: match._id } : d)}
                  />
                </div>

                {warnings.length > 0 && (
                  <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/20 text-sm">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="space-y-1 text-amber-900 dark:text-amber-200">
                      {warnings.map((w) => (
                        <p key={w}>{w}</p>
                      ))}
                    </AlertDescription>
                  </Alert>
                )}

                <MergeFieldReview
                  rows={diffRows}
                  choices={fieldChoices}
                  onChange={onChoice}
                  primaryLabel={formatFullName(primaryStudent) || 'Primary'}
                  secondaryLabel={formatFullName(secondaryStudent) || 'Secondary'}
                />

                {drawerEligible && (
                  <div className="flex items-start gap-3 rounded-md border px-3 py-2.5">
                    <Checkbox
                      id="transfer-drawer"
                      checked={transferDrawer}
                      onCheckedChange={(v) => setTransferDrawer(v === true)}
                      disabled={actioning}
                    />
                    <div className="space-y-0.5">
                      <Label htmlFor="transfer-drawer" className="text-sm font-medium cursor-pointer">
                        Transfer drawer location to primary
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Primary is unassigned; secondary has a cabinet/drawer. Keep that slot on the
                        surviving record instead of freeing it.
                      </p>
                    </div>
                  </div>
                )}

                <Alert variant="destructive" className="text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    The <strong>non-primary</strong> record will be deleted after your field choices
                    are applied. Undo from the snackbar (~60s) or Recent merges (~15 minutes).
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
                void doAction(
                  'merge',
                  mergeDialog.primaryId,
                  secondaryId,
                  fieldChoices,
                  transferDrawer,
                );
              }}
            >
              {actioning && <Loader2 size={14} className="animate-spin" />}
              <GitMerge size={14} />
              Merge & Delete Secondary
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {recentMerges.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <GitMerge className="h-4 w-4" /> Recent merges
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Durable history for this school. Undo is available for about 15 minutes after a merge
              (snackbar also offers Undo for ~60 seconds).
            </p>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border divide-y">
              {recentMerges.map((m) => (
                <div
                  key={m._id}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between px-3 py-2.5 text-sm"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-medium truncate">
                      Kept <span className="text-foreground">{m.primaryName || m.primaryId}</span>
                      {' · '}
                      removed <span className="text-muted-foreground">{m.secondaryName || m.secondaryId}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(m.at).toLocaleString()}
                      {m.byEmail ? ` · ${m.byName || m.byEmail}` : ''}
                      {m.fieldCount ? ` · ${m.fieldCount} field change${m.fieldCount === 1 ? '' : 's'}` : ''}
                      {m.drawerTransferred ? ' · drawer transferred' : ''}
                    </p>
                  </div>
                  {m.canUndo ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 shrink-0"
                      disabled={actioning}
                      onClick={() => void handleUndoMerge(m._id)}
                    >
                      Undo
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {Math.ceil(m.undoRemainingMs / 60000)}m
                      </span>
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground shrink-0">Undo expired</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <UndoSnackbar
        open={showMergeUndo}
        onUndo={() => { void handleUndoMerge(); }}
        message="Records merged — secondary deleted. Undo available ~60s (or 15m from Recent merges)."
      />
    </div>
  );
}
