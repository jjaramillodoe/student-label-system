'use client';

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type AnalyticsMetricCardProps = {
  label: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  tone?: 'default' | 'success' | 'warning' | 'info';
  footer?: ReactNode;
  className?: string;
};

const toneStyles: Record<
  NonNullable<AnalyticsMetricCardProps['tone']>,
  { icon: string; value?: string }
> = {
  default: { icon: 'text-muted-foreground bg-muted/60' },
  success: { icon: 'text-emerald-700 bg-emerald-500/10 dark:text-emerald-300', value: 'text-emerald-800 dark:text-emerald-200' },
  warning: { icon: 'text-amber-700 bg-amber-500/10 dark:text-amber-300', value: 'text-amber-800 dark:text-amber-200' },
  info: { icon: 'text-sky-700 bg-sky-500/10 dark:text-sky-300' },
};

export default function AnalyticsMetricCard({
  label,
  value,
  description,
  icon: Icon,
  tone = 'default',
  footer,
  className,
}: AnalyticsMetricCardProps) {
  const styles = toneStyles[tone];

  return (
    <Card className={cn('border-border/80 shadow-none', className)}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
        <span
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg',
            styles.icon,
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
      </CardHeader>
      <CardContent className="space-y-1">
        <p
          className={cn(
            'text-2xl font-semibold tracking-tight tabular-nums',
            styles.value,
          )}
        >
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        {description && (
          <p className="text-xs text-muted-foreground leading-snug">{description}</p>
        )}
        {footer}
      </CardContent>
    </Card>
  );
}
