'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ClipboardList, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Student } from '@/components/StudentTable';
import { formatFullName } from '@/lib/personName';

interface IntakePrintQueueProps {
  students: Student[];
  printedIds: Set<string>;
  onSelectForPrint: (ids: string[]) => void;
  /** Optional: turn on Dashboard Needs label filter */
  onShowNeedsLabel?: () => void;
}

function neverPrinted(student: Student, printedIds: Set<string>): boolean {
  if (student.archived) return false;
  const keys = [student.labelId, student.studentId].filter(Boolean) as string[];
  if (keys.length === 0) return true;
  return !keys.some(k => printedIds.has(k));
}

export default function IntakePrintQueue({
  students,
  printedIds,
  onSelectForPrint,
  onShowNeedsLabel,
}: IntakePrintQueueProps) {
  const { preview, total, ids } = useMemo(() => {
    const all = students
      .filter(s => neverPrinted(s, printedIds))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    const previewRows = all.slice(0, 12);
    return {
      preview: previewRows,
      total: all.length,
      ids: previewRows.map(s => s._id!).filter(Boolean),
    };
  }, [students, printedIds]);

  if (total === 0) return null;

  return (
    <section className="mb-6 rounded-lg border border-amber-200 bg-amber-50/80 dark:border-amber-900 dark:bg-amber-950/20 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <div className="flex items-start gap-2">
          <ClipboardList className="h-5 w-5 text-amber-700 dark:text-amber-400 mt-0.5 shrink-0" />
          <div>
            <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              Needs label — never printed
            </h2>
            <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
              {total} student{total === 1 ? '' : 's'} not yet in print history
              {total > preview.length ? ` (showing newest ${preview.length})` : ''}.
              Same rule as the <strong>Needs label</strong> chip below.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {onShowNeedsLabel && total > preview.length && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-2 bg-background/80"
              onClick={onShowNeedsLabel}
            >
              View all ({total})
            </Button>
          )}
          {!onShowNeedsLabel && total > preview.length && (
            <Button type="button" size="sm" variant="outline" className="gap-2 bg-background/80" asChild>
              <Link href="/?needsLabel=1">View all ({total})</Link>
            </Button>
          )}
          <Button
            size="sm"
            className="gap-2"
            onClick={() => onSelectForPrint(ids)}
          >
            <Printer className="h-4 w-4" />
            Select for print ({preview.length})
          </Button>
        </div>
      </div>
      <ul className="flex flex-wrap gap-2">
        {preview.map(s => (
          <li key={s._id}>
            <Badge
              variant="outline"
              className="cursor-pointer bg-background/80 hover:bg-background gap-1.5 font-normal"
              onClick={() => s._id && onSelectForPrint([s._id])}
              title="Select for print"
            >
              <span className="font-medium">
                {formatFullName(s)}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {s.labelId || s.studentId || '—'}
              </span>
            </Badge>
          </li>
        ))}
      </ul>
    </section>
  );
}
