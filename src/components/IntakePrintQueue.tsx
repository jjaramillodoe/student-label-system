'use client';

import { useMemo } from 'react';
import { ClipboardList, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Student } from '@/components/StudentTable';

interface IntakePrintQueueProps {
  students: Student[];
  printedIds: Set<string>;
  onSelectForPrint: (ids: string[]) => void;
}

function daysAgo(iso?: string) {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return (Date.now() - t) / (1000 * 60 * 60 * 24);
}

export default function IntakePrintQueue({
  students,
  printedIds,
  onSelectForPrint,
}: IntakePrintQueueProps) {
  const needsLabels = useMemo(() => {
    return students
      .filter(s => !s.archived)
      .filter(s => daysAgo(s.createdAt) <= 7)
      .filter(s => {
        const keys = [s.labelId, s.studentId].filter(Boolean) as string[];
        if (keys.length === 0) return true;
        return !keys.some(k => printedIds.has(k));
      })
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .slice(0, 12);
  }, [students, printedIds]);

  if (needsLabels.length === 0) return null;

  const ids = needsLabels.map(s => s._id!).filter(Boolean);

  return (
    <section className="mb-6 rounded-lg border border-amber-200 bg-amber-50/80 dark:border-amber-900 dark:bg-amber-950/20 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <div className="flex items-start gap-2">
          <ClipboardList className="h-5 w-5 text-amber-700 dark:text-amber-400 mt-0.5 shrink-0" />
          <div>
            <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              Recent intakes ready for labels
            </h2>
            <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
              Students created in the last 7 days who are not in recent print history.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          className="gap-2 bg-purple-600 hover:bg-purple-700 shrink-0"
          onClick={() => onSelectForPrint(ids)}
        >
          <Printer className="h-4 w-4" />
          Select all for print ({needsLabels.length})
        </Button>
      </div>
      <ul className="flex flex-wrap gap-2">
        {needsLabels.map(s => (
          <li key={s._id}>
            <Badge
              variant="outline"
              className="cursor-pointer bg-background/80 hover:bg-background gap-1.5 font-normal"
              onClick={() => s._id && onSelectForPrint([s._id])}
              title="Select for print"
            >
              <span className="font-medium">
                {s.firstName} {s.lastName}
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
