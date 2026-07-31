'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { Cabinet } from '@/types/cabinet';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentIds: string[];
  studentLabel?: string;
  source: string;
  onDone: (message: string) => void;
};

export default function FixStudentAssignmentDialog({
  open,
  onOpenChange,
  studentIds,
  studentLabel,
  source,
  onDone,
}: Props) {
  const [cabinets, setCabinets] = useState<Cabinet[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cabinetId, setCabinetId] = useState('');
  const [drawerId, setDrawerId] = useState('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError('');
    fetch('/api/cabinets')
      .then((r) => r.json())
      .then((data) => {
        const list = (Array.isArray(data) ? data : []).filter(
          (c: Cabinet) => (c.status ?? 'Active') !== 'Archived',
        );
        setCabinets(list);
      })
      .catch(() => setError('Failed to load cabinets'))
      .finally(() => setLoading(false));
  }, [open]);

  const drawers = useMemo(() => {
    const cab = cabinets.find((c) => c._id === cabinetId);
    return cab?.drawers || [];
  }, [cabinets, cabinetId]);

  async function assign(mode: 'auto' | 'manual') {
    setBusy(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        studentIds,
        source,
        note: mode === 'auto' ? 'Assigned to next open slot' : 'Assigned from fix dialog',
      };
      if (mode === 'manual') {
        if (!cabinetId || !drawerId) {
          setError('Pick a cabinet and drawer');
          setBusy(false);
          return;
        }
        body.targetCabinetId = cabinetId;
        body.targetDrawerId = drawerId;
      }
      const res = await fetch('/api/admin/assign-next-slot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Assign failed');
      onDone(data.message || `Moved ${data.moved} student(s)`);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assign failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fix assignment</DialogTitle>
          <DialogDescription>
            {studentLabel
              ? `Assign ${studentLabel} to an active drawer.`
              : `Assign ${studentIds.length} student(s) to an active drawer.`}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading cabinets…
          </div>
        ) : (
          <div className="space-y-4">
            <Button
              className="w-full"
              onClick={() => assign('auto')}
              disabled={busy || studentIds.length === 0}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Assign to next open slot
            </Button>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">or choose</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Cabinet</Label>
              <Select
                value={cabinetId}
                onValueChange={(v) => {
                  setCabinetId(v);
                  setDrawerId('');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select cabinet" />
                </SelectTrigger>
                <SelectContent>
                  {cabinets.map((c) => (
                    <SelectItem key={c._id} value={c._id}>
                      {c.identifier ? `${c.name} (${c.identifier})` : c.name}
                      {c.school ? ` · ${c.school}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Drawer</Label>
              <Select value={drawerId} onValueChange={setDrawerId} disabled={!cabinetId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select drawer" />
                </SelectTrigger>
                <SelectContent>
                  {drawers.map((d) => {
                    const left = (d.capacity || 0) - (d.currentCount || 0);
                    const locked = Boolean(d.locked);
                    return (
                      <SelectItem
                        key={d._id}
                        value={d._id}
                        disabled={left <= 0 || locked}
                      >
                        {d.name} ({d.currentCount}/{d.capacity}
                        {locked ? ' · locked' : left <= 0 ? ' · full' : ` · ${left} left`})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => assign('manual')} disabled={busy || !cabinetId || !drawerId}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Move here
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
