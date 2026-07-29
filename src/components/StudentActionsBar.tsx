'use client';

import { Button } from '@/components/ui/button';
import { FileDown, Edit, Archive, Trash2, Printer, ScanLine, AlertTriangle } from 'lucide-react';
import ReprintButton from './ReprintButton';

// Labels-per-sheet for Avery sheet layouts
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

  // Sheet-count hint for Avery layouts
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
        onClick={onExportCsv}
        variant="outline"
        className="gap-2"
      >
        <FileDown size={18} /> Export CSV
      </Button>
      <Button
        onClick={onPrintSelected}
        disabled={!hasSelection}
        variant="default"
        className="gap-2 bg-purple-600 hover:bg-purple-700"
      >
        <Printer size={18} /> Print Selected ({selectedCount})
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
      <Button
        onClick={onPrintAllFiltered}
        disabled={filteredCount === 0}
        variant="default"
        className="gap-2 bg-indigo-600 hover:bg-indigo-700"
      >
        <Printer size={18} /> Print All Filtered ({filteredCount})
      </Button>
      <ReprintButton
        onReprint={onReprint}
        onReprintLast={onReprintLast}
      />
      <Button
        onClick={onToggleQRCode}
        variant="outline"
        className="gap-2"
      >
        <ScanLine size={16} /> {showQRCode ? 'Hide' : 'Show'} QR
      </Button>
      {hasSelection && (
        <div className="flex gap-2 flex-wrap items-center rounded-md border bg-muted/30 p-1">
          <span className="px-2 text-xs font-medium text-muted-foreground">
            {selectedCount} selected
          </span>
          <Button
            onClick={onExportSelected}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <FileDown size={16} /> Export CSV
          </Button>
          <Button
            onClick={onBulkUpdate}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Edit size={16} /> Update
          </Button>
          <Button
            onClick={onBulkArchive}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Archive size={16} /> Archive
          </Button>
          {['Data Lead', 'Admin'].includes(userRole || '') && (
            <Button
              onClick={onBulkDelete}
              variant="destructive"
              size="sm"
              className="gap-2"
            >
              <Trash2 size={16} /> Delete
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

