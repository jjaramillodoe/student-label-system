'use client';

import { formatHumanDate } from '@/lib/utils';
import {
  beEslAgeHintMessage,
  checkBeEslAgeEligibility,
} from '@/lib/beEslEligibility';

export function DateHumanHint({ value }: { value: string }) {
  const label = formatHumanDate(value);
  if (!label) return null;
  return <p className="text-sm font-medium text-foreground">{label}</p>;
}

export function BeEslAgeHint({ check }: { check: ReturnType<typeof checkBeEslAgeEligibility> }) {
  const message = beEslAgeHintMessage(check);
  const tone = check.eligible
    ? 'text-xs text-green-700 dark:text-green-400'
    : check.nearEligible
      ? 'text-xs font-medium text-amber-800 dark:text-amber-300'
      : 'text-xs font-medium text-destructive';
  return (
    <p className={tone} role={check.eligible ? undefined : 'status'}>
      {message}
    </p>
  );
}

