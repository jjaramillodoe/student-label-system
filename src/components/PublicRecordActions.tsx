'use client';

import { ArrowLeft, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function HistoryBackButton({
  className,
  variant = 'ghost',
  size = 'icon',
  label = 'Go back',
}: {
  className?: string;
  variant?: 'ghost' | 'outline';
  size?: 'icon' | 'default' | 'sm';
  label?: string;
}) {
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      aria-label={label}
      onClick={() => window.history.back()}
    >
      <ArrowLeft size={size === 'icon' ? 18 : 16} />
      {size !== 'icon' && <span>{label}</span>}
    </Button>
  );
}

export function PrintPageButton({
  className,
  size = 'sm',
}: {
  className?: string;
  size?: 'sm' | 'default';
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      className={className}
      onClick={() => window.print()}
    >
      <Printer size={14} /> Print
    </Button>
  );
}
