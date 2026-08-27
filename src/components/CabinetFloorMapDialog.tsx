'use client';

import { LayoutGrid } from 'lucide-react';
import CabinetFloorMap from '@/components/CabinetFloorMap';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Cabinet } from '@/types/cabinet';

export default function CabinetFloorMapDialog({
  open,
  onOpenChange,
  cabinets,
  highlightCabinetId,
  onUpdated,
  onSelectCabinet,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cabinets: Cabinet[];
  highlightCabinetId?: string | null;
  onUpdated: () => void;
  onSelectCabinet: (cabinet: Cabinet) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5" /> Floor / room map
          </DialogTitle>
          <DialogDescription>
            Drag cabinets onto the grid to match the room layout. Positions save immediately.
          </DialogDescription>
        </DialogHeader>
        <CabinetFloorMap
          cabinets={cabinets}
          highlightCabinetId={highlightCabinetId}
          onUpdated={onUpdated}
          onSelectCabinet={onSelectCabinet}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
