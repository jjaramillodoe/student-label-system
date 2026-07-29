'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FileDown, Edit, Archive, Trash2, Printer, ScanLine, AlertTriangle, MoreHorizontal, History } from 'lucide-react';
import ReprintButton from './ReprintButton';

const SHEET_SIZES: Record<string, number> = {
  avery5160: 30,
  avery5163: 10,
  avery94205: 10,
};

interface StudentActionsBarProps {
  selectedCount: number;
  filteredCount: number;
  userRole?: string;
  printLayout?: string;
  onExportCsv: () => void;
  onExportSelected: () => void;
  onBulkUpdate: () => void;
  onBulkArchive: () => void;
  onBulkDelete: () => void;
  onPrintSelected: () => void;
  onPrintAllFiltered: () => void;
  onReprint: (studentIds: string[]) => void;
  onReprintLast: () => void;
  onToggleQRCode: () => void;
  showQRCode: boolean;
}

export default function StudentActionsBar({
  selectedCount,
  filteredCount,
  userRole,
  printLayout = '',
  onExportCsv,
  onExportSelected,
  onBulkUpdate,
  onBulkArchive,
  onBulkDelete,
  onPrintSelected,
  onPrintAllFiltered,
  onReprint,
  onReprintLast,
  onToggleQRCode,
  showQRCode,
}: StudentActionsBarProps) {
  const hasSelection = selectedCount > 0;

  const labelsPerSheet = SHEET_SIZES[printLayout] ?? 0;
  const sheetHint = (() => {
    if (!labelsPerSheet || !hasSelection) return null;
    const remainder = selectedCount % labelsPerSheet;
    if (remainder === 0) {
      const sheets = selectedCount / labelsPerSheet;
      return { ok: true, msg: `${sheets} full sheet${sheets !== 1 ? 's' : ''} (${labelsPerSheet} labels each)` };
    }
    const toAdd = labelsPerSheet - remainder;
    const sheets = Math.ceil(selectedCount / labelsPerSheet);
    return {
      ok: false,
      msg: `${sheets} sheet${sheets !== 1 ? 's' : ''} — add ${toAdd} more to fill the last sheet`,
    };
  })();

  return (
    <div className="flex gap-2 mb-4 flex-wrap items-center">
      <Button
        onClick={onPrintSelected}
        disabled={!hasSelection}
        variant="default"
        className="gap-2 bg-purple-600 hover:bg-purple-700"
      >
        <Printer size={18} /> Print Selected ({selectedCount})
      </Button>
      <Button
        onClick={onPrintAllFiltered}
        disabled={filteredCount === 0}
        variant="outline"
        className="gap-2"
      >
        <Printer size={18} /> Print All ({filteredCount})
      </Button>
      {sheetHint && (
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md border ${
          sheetHint.ok
            ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-950/30 dark:border-green-800 dark:text-green-400'
            : 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400'
        }`}>
          {!sheetHint.ok && <AlertTriangle size={12} />}
          {sheetHint.msg}
        </span>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            <MoreHorizontal size={16} />
            More actions
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Export & display</DropdownMenuLabel>
          <DropdownMenuItem onClick={onExportCsv}>
            <FileDown className="h-4 w-4 mr-2" />
            Export CSV (all)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onToggleQRCode}>
            <ScanLine className="h-4 w-4 mr-2" />
            {showQRCode ? 'Hide' : 'Show'} QR codes
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onReprintLast}>
            <History className="h-4 w-4 mr-2" />
            Reprint last job
          </DropdownMenuItem>
          {hasSelection && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>{selectedCount} selected</DropdownMenuLabel>
              <DropdownMenuItem onClick={onExportSelected}>
                <FileDown className="h-4 w-4 mr-2" />
                Export selected CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onBulkUpdate}>
                <Edit className="h-4 w-4 mr-2" />
                Bulk update
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onBulkArchive}>
                <Archive className="h-4 w-4 mr-2" />
                Archive selected
              </DropdownMenuItem>
              {['Data Lead', 'Admin'].includes(userRole || '') && (
                <DropdownMenuItem onClick={onBulkDelete} className="text-destructive focus:text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete selected
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ReprintButton onReprint={onReprint} onReprintLast={onReprintLast} />

      {hasSelection && (
        <span className="text-xs text-muted-foreground px-1">
          {selectedCount} selected
        </span>
      )}
    </div>
  );
}
