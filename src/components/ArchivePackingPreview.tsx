'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { ArchiveBox } from '@/types/cabinet';

export const PARTIAL_ARCHIVE_STATUSES = [
  'Graduated',
  'Transferred',
  'Withdrawn',
  'Inactive',
] as const;

type PreviewRow = {
  studentId: string;
  name: string;
  labelId?: string;
  status?: string;
  drawerName?: string;
  boxId: string | null;
  boxLabel: string | null;
  boxNumber: number | null;
};

type PreviewBox = {
  _id: string;
  label: string;
  boxNumber: number;
  maxCapacity: number;
  currentCount: number;
};

type Props = {
  cabinetId: string;
  schoolYear: string;
  boxes: ArchiveBox[];
  statuses: string[];
  drawerIds: string[];
  manualAssignments: Record<string, string>;
  onManualChange: (next: Record<string, string>) => void;
};

export default function ArchivePackingPreview({
  cabinetId,
  schoolYear,
  boxes,
  statuses,
  drawerIds,
  manualAssignments,
  onManualChange,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [previewBoxes, setPreviewBoxes] = useState<PreviewBox[]>([]);
  const [enough, setEnough] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/cabinets/${cabinetId}/archive/preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            schoolYear,
            boxes,
            statuses: statuses.length ? statuses : undefined,
            drawerIds: drawerIds.length ? drawerIds : undefined,
            manualAssignments,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Preview failed');
        if (cancelled) return;
        setRows(data.rows || []);
        setPreviewBoxes(data.boxes || []);
        setEnough(data.enoughCapacity !== false);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Preview failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [cabinetId, schoolYear, boxes, statuses, drawerIds, manualAssignments]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" /> Building packing preview…
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {rows.length} student(s) → {previewBoxes.length} box(es)
        </p>
        {!enough && (
          <Badge variant="destructive">Not enough box capacity</Badge>
        )}
      </div>
      <div className="rounded-md border max-h-64 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Drawer</TableHead>
              <TableHead>Box</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.studentId}>
                <TableCell>
                  <div className="font-medium text-sm">{row.name}</div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {row.labelId || '—'} · {row.status || '—'}
                  </div>
                </TableCell>
                <TableCell className="text-sm">{row.drawerName || '—'}</TableCell>
                <TableCell>
                  <Select
                    value={row.boxId || ''}
                    onValueChange={(boxId) => {
                      onManualChange({ ...manualAssignments, [row.studentId]: boxId });
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Box" />
                    </SelectTrigger>
                    <SelectContent>
                      {previewBoxes.map((b) => (
                        <SelectItem key={b._id} value={b._id}>
                          Box {b.boxNumber} ({b.currentCount}/{b.maxCapacity})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onManualChange({})}
      >
        Reset to auto packing
      </Button>
    </div>
  );
}
