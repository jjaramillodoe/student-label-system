'use client';

import { useState } from 'react';
import { ChevronDown, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { fmtHM, totalVisitMinutes, visitMinutes } from '@/lib/intakeVisitTime';

export default function ReturningVisitHistory({ visits }: { visits: any[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const sorted = [...visits].sort(
    (a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime(),
  );

  return (
    <div className="rounded-md border border-border bg-background px-3 py-2.5 text-xs space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-medium text-foreground flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          {sorted.length} previous visit{sorted.length !== 1 ? 's' : ''}
        </span>
        <Badge variant="outline" className="text-[10px]">
          Total so far: {fmtHM(totalVisitMinutes(sorted))}
        </Badge>
      </div>
      <div className="space-y-1">
        {sorted.map((v, i) => {
          const isOpen = openIdx === i;
          const mins = visitMinutes(v?.timeIn, v?.timeOut);
          const dateLabel = v?.date
            ? new Date(v.date).toLocaleString('en-US', {
                month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
              })
            : '—';
          const summary = [
            v?.educationStatus,
            v?.intakeActivity?.length ? v.intakeActivity.join(', ') : null,
          ].filter(Boolean).join(' · ') || 'Visit recorded';

          return (
            <div key={`${v.date}-${i}`} className="rounded-md border border-border/80 overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenIdx(isOpen ? null : i)}
                className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-muted/40 transition-colors"
              >
                <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                <span className="flex-1 min-w-0">
                  <span className="font-medium text-foreground">Visit {i + 1}</span>
                  <span className="text-muted-foreground"> · {dateLabel}</span>
                  <span className="block text-[10px] text-muted-foreground truncate">{summary}</span>
                </span>
                <span className="shrink-0 font-medium text-foreground">
                  {v?.isLeaving === 'Staying' ? 'Staying' : (mins != null ? fmtHM(mins) : '—')}
                </span>
              </button>
              {isOpen && (
                <div className="px-3 pb-2.5 pt-0 space-y-1.5 border-t border-dashed text-muted-foreground">
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-2">
                    <p><span className="text-foreground/70">Time in:</span> {v?.timeIn || '—'}</p>
                    <p>
                      <span className="text-foreground/70">Time out:</span>{' '}
                      {v?.isLeaving === 'Staying' ? 'Staying' : (v?.timeOut || '—')}
                    </p>
                    <p><span className="text-foreground/70">BE / ESL:</span> {v?.educationStatus || '—'}</p>
                    <p><span className="text-foreground/70">Session:</span> {v?.intakeSession || '—'}</p>
                    <p className="col-span-2">
                      <span className="text-foreground/70">Activity:</span>{' '}
                      {v?.intakeActivity?.length ? v.intakeActivity.join(', ') : '—'}
                    </p>
                    {v?.placementClass && (
                      <p className="col-span-2">
                        <span className="text-foreground/70">Placement:</span> {v.placementClass}
                      </p>
                    )}
                    {v?.notes && (
                      <p className="col-span-2">
                        <span className="text-foreground/70">Notes:</span> {v.notes}
                      </p>
                    )}
                    <p className="col-span-2 text-[10px] italic">
                      Recorded by {v?.recordedBy?.name || v?.recordedBy?.email || '—'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground italic">
        Complete today&apos;s visit below — each submission adds a new entry here.
      </p>
    </div>
  );
}
