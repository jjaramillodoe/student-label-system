'use client';

import { Printer, Tag } from 'lucide-react';
import CabinetStorageLabelSheet from '@/components/CabinetStorageLabelSheet';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { StorageLabelItem, StorageLabelKind } from '@/lib/cabinetLabel';

type LabelFilter = 'all' | StorageLabelKind;

export default function CabinetStorageLabelsDialog({
  open,
  onOpenChange,
  title,
  labels,
  filter,
  onFilterChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  labels: StorageLabelItem[];
  filter: LabelFilter;
  onFilterChange: (filter: LabelFilter) => void;
}) {
  const visible = filter === 'all' ? labels : labels.filter((l) => l.kind === filter);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" /> Storage Labels — {title}
          </DialogTitle>
          <DialogDescription>
            Print and attach to the physical cabinet, drawer fronts, and section dividers.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2 mb-3">
          {(['all', 'cabinet', 'drawer', 'section'] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? 'default' : 'outline'}
              onClick={() => onFilterChange(f)}
            >
              {f === 'all' ? `All (${labels.length})` : f}
            </Button>
          ))}
        </div>
        <CabinetStorageLabelSheet labels={visible} />
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            className="gap-2"
            onClick={() => window.print()}
            disabled={visible.length === 0}
          >
            <Printer className="h-4 w-4" /> Print Labels
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
