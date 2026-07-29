'use client';

import { Printer, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SelectionPrintTrayProps {
  selectedCount: number;
  printLayout?: string;
  sheetHint?: { ok: boolean; msg: string } | null;
  onPrint: () => void;
  onClear: () => void;
  /** Hide while print preview is open */
  hidden?: boolean;
  /** Show tray once this many are selected (default 1) */
  minCount?: number;
}

export default function SelectionPrintTray({
  selectedCount,
  sheetHint,
  onPrint,
  onClear,
  hidden = false,
  minCount = 1,
}: SelectionPrintTrayProps) {
  if (hidden || selectedCount < minCount) return null;

  return (
    <div
      className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 w-[calc(100%-1.5rem)] max-w-xl"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 rounded-xl border bg-background/95 backdrop-blur shadow-lg px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">
            {selectedCount} student{selectedCount === 1 ? '' : 's'} selected
          </p>
          {sheetHint && (
            <p className={`text-xs truncate ${sheetHint.ok ? 'text-muted-foreground' : 'text-amber-700 dark:text-amber-400'}`}>
              {sheetHint.msg}
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0"
          onClick={onClear}
          aria-label="Clear selection"
        >
          <X className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          className="gap-2 shrink-0 bg-purple-600 hover:bg-purple-700"
          onClick={onPrint}
        >
          <Printer className="h-4 w-4" />
          Print
        </Button>
      </div>
    </div>
  );
}
