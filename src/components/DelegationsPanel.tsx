'use client';

import { useEffect, useState } from 'react';
import { CalendarClock, Check, Loader2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DELEGATION_MAX_DAYS,
  delegationDays,
  formatDelegationDate,
  schoolToday,
  type DelegationPhase,
  type DelegationView,
} from '@/lib/delegation';

const OPEN_PHASES: DelegationPhase[] = ['pending', 'scheduled', 'active'];

const PHASE_LABEL: Record<DelegationPhase, string> = {
  pending: 'Waiting for Admin',
  scheduled: 'Scheduled',
  active: 'Active',
  expired: 'Ended',
  denied: 'Denied',
  revoked: 'Revoked',
};

function phaseVariant(phase: DelegationPhase) {
  if (phase === 'active') return 'default' as const;
  if (phase === 'pending' || phase === 'scheduled') return 'secondary' as const;
  return 'outline' as const;
}

function range(d: Pick<DelegationView, 'startDate' | 'endDate'>) {
  return `${formatDelegationDate(d.startDate)} – ${formatDelegationDate(d.endDate)}`;
}

/** Short badge text for a user's row in the users table, or null when nothing is open. */
export function delegationRowLabel(d: DelegationView | undefined): string | null {
  if (!d) return null;
  if (d.phase === 'active') return `Acting Data Lead · until ${formatDelegationDate(d.endDate)}`;
  if (d.phase === 'scheduled') return `Acting Data Lead from ${formatDelegationDate(d.startDate)}`;
  if (d.phase === 'pending') return 'Delegation waiting for Admin';
  return null;
}

export function openDelegationFor(delegations: DelegationView[], userId: string) {
  return delegations.find((d) => d.userId === userId && OPEN_PHASES.includes(d.phase));
}

type PanelProps = {
  delegations: DelegationView[];
  isAdmin: boolean;
  busyId: string | null;
  onAction: (id: string, action: 'approve' | 'deny' | 'revoke') => void;
};

export function DelegationsPanel({ delegations, isAdmin, busyId, onAction }: PanelProps) {
  const [showHistory, setShowHistory] = useState(false);
  const open = delegations.filter((d) => OPEN_PHASES.includes(d.phase));
  const history = delegations.filter((d) => !OPEN_PHASES.includes(d.phase));
  const shown = showHistory ? delegations : open;
  const pendingCount = open.filter((d) => d.phase === 'pending').length;

  if (delegations.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5" />
              Acting Data Leads
              {isAdmin && pendingCount > 0 && (
                <Badge variant="destructive">{pendingCount} to review</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Data Members covering for a Data Lead for a set date range. Access ends on its own after the last day.
            </CardDescription>
          </div>
          {history.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setShowHistory((v) => !v)}>
              {showHistory ? 'Hide past' : `Show past (${history.length})`}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open delegations.</p>
        ) : (
          <ul className="divide-y">
            {shown.map((d) => (
              <li key={d._id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{d.userName || d.userEmail}</span>
                    <Badge variant={phaseVariant(d.phase)}>{PHASE_LABEL[d.phase]}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {range(d)} · {delegationDays(d.startDate, d.endDate)} days{isAdmin ? ` · ${d.school}` : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Requested by {d.requestedBy.name || d.requestedBy.email}
                    {d.reason ? ` · “${d.reason}”` : ''}
                    {d.reviewedBy && d.status !== 'pending'
                      ? ` · ${d.status === 'denied' ? 'Denied' : 'Approved'} by ${d.reviewedBy.name || d.reviewedBy.email}`
                      : ''}
                    {d.revokedBy ? ` · Revoked by ${d.revokedBy.name || d.revokedBy.email}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {isAdmin && d.phase === 'pending' && (
                    <>
                      <Button size="sm" className="gap-1" disabled={busyId === d._id} onClick={() => onAction(d._id, 'approve')}>
                        {busyId === d._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1" disabled={busyId === d._id} onClick={() => onAction(d._id, 'deny')}>
                        <X className="h-4 w-4" />
                        Deny
                      </Button>
                    </>
                  )}
                  {OPEN_PHASES.includes(d.phase) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      disabled={busyId === d._id}
                      onClick={() => onAction(d._id, 'revoke')}
                    >
                      {d.phase === 'pending' ? 'Cancel request' : 'Revoke'}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

type DialogProps = {
  user: { _id: string; name: string; email: string } | null;
  isAdmin: boolean;
  onClose: () => void;
  onCreated: (d: DelegationView) => void;
};

export function DelegateDialog({ user, isAdmin, onClose, onCreated }: DialogProps) {
  const today = schoolToday();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    setStartDate(schoolToday());
    setEndDate('');
    setReason('');
    setError('');
  }, [user]);

  const days = startDate && endDate && endDate >= startDate ? delegationDays(startDate, endDate) : 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/delegations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user._id, startDate, endDate, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save delegation');
      onCreated(data.delegation);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save delegation');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={Boolean(user)} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            Make Acting Data Lead
          </DialogTitle>
          <DialogDescription>
            {user?.name} gets Data Lead access for these dates only, then goes back to Data Member
            on their own. {isAdmin
              ? 'Because you are an Admin, this is approved right away.'
              : 'An Admin must approve it first.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="delegationStart">First day</Label>
              <Input
                id="delegationStart"
                type="date"
                min={today}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="delegationEnd">Last day</Label>
              <Input
                id="delegationEnd"
                type="date"
                min={startDate || today}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>
          <p className={`text-xs ${days > DELEGATION_MAX_DAYS ? 'text-destructive' : 'text-muted-foreground'}`}>
            {days ? `${days} day${days === 1 ? '' : 's'} · ` : ''}Up to {DELEGATION_MAX_DAYS} days.
          </p>
          <div className="space-y-2">
            <Label htmlFor="delegationReason">Reason (optional)</Label>
            <Input
              id="delegationReason"
              value={reason}
              maxLength={200}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Vacation"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving || !endDate || days > DELEGATION_MAX_DAYS}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isAdmin ? 'Make Acting Data Lead' : 'Send to Admin'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
