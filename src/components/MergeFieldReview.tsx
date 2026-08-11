'use client';

import { Button } from '@/components/ui/button';
import {
  ADDRESS_GROUP_KEY,
  type MergeFieldChoices,
  type MergeFieldDiffRow,
  type MergeSource,
} from '@/lib/mergeFields';

function statusBadge(status: MergeFieldDiffRow['status']): { className: string; label: string } {
  switch (status) {
    case 'conflict':
      return { className: 'ui-badge-warning', label: 'Conflict' };
    case 'only_primary':
      return { className: 'ui-badge-muted', label: 'Only primary' };
    case 'only_secondary':
      return { className: 'ui-badge-info', label: 'Only secondary' };
    case 'same':
      return { className: 'ui-badge-success', label: 'Same' };
    default:
      return { className: 'ui-badge-muted', label: 'Empty' };
  }
}

export default function MergeFieldReview({
  rows,
  choices,
  onChange,
  primaryLabel = 'Primary',
  secondaryLabel = 'Secondary',
}: {
  rows: MergeFieldDiffRow[];
  choices: MergeFieldChoices;
  onChange: (key: keyof MergeFieldChoices, source: MergeSource) => void;
  primaryLabel?: string;
  secondaryLabel?: string;
}) {
  const actionable = rows.filter((r) => r.status !== 'both_empty');
  const conflicts = actionable.filter((r) => r.status === 'conflict').length;

  if (actionable.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No contact or address fields to merge — primary already has everything, or both are empty.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          Choose values to keep
          {conflicts > 0 && (
            <span className="ml-2 text-xs font-normal text-amber-700 dark:text-amber-300">
              {conflicts} conflict{conflicts === 1 ? '' : 's'}
            </span>
          )}
        </p>
        <div className="flex gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => {
              for (const row of actionable) onChange(row.key, 'primary');
            }}
          >
            All primary
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => {
              for (const row of actionable) {
                if (row.status === 'only_secondary' || row.status === 'conflict') {
                  onChange(row.key, 'secondary');
                }
              }
            }}
          >
            Prefer secondary fills
          </Button>
        </div>
      </div>

      <div className="rounded-md border divide-y max-h-[280px] overflow-y-auto">
        {actionable.map((row) => {
          const badge = statusBadge(row.status);
          const choice = choices[row.key] || row.defaultChoice;
          const isAddress = row.key === ADDRESS_GROUP_KEY;
          return (
            <div
              key={row.key}
              className={`px-3 py-2.5 space-y-2 ${
                row.status === 'conflict' ? 'bg-amber-50/60 dark:bg-amber-950/15' : ''
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{row.label}</span>
                <span className={`${badge.className} text-[10px]`}>{badge.label}</span>
                {isAddress && (
                  <span className="text-[10px] text-muted-foreground">
                    Street, apt, city, ZIP + verification kept together
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onChange(row.key, 'primary')}
                  className={`text-left rounded-md border px-2.5 py-2 text-xs transition-colors ${
                    choice === 'primary'
                      ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/30 ring-1 ring-blue-300'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
                    {primaryLabel}
                  </div>
                  <div className="font-medium break-words whitespace-pre-wrap">{row.primaryDisplay}</div>
                </button>
                <button
                  type="button"
                  onClick={() => onChange(row.key, 'secondary')}
                  disabled={row.status === 'only_primary'}
                  className={`text-left rounded-md border px-2.5 py-2 text-xs transition-colors ${
                    choice === 'secondary'
                      ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/30 ring-1 ring-blue-300'
                      : 'border-border hover:bg-muted/50'
                  } disabled:opacity-40 disabled:pointer-events-none`}
                >
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
                    {secondaryLabel}
                  </div>
                  <div className="font-medium break-words whitespace-pre-wrap">{row.secondaryDisplay}</div>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
