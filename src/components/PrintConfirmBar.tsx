'use client';

import { Button } from '@/components/ui/button';
import { Check, Loader2 } from 'lucide-react';

type Props = {
  confirming?: boolean;
  onConfirm: () => void;
  onDecline: () => void;
  /** Compact variant for dialogs (no fixed positioning). */
  variant?: 'toast' | 'inline';
  plural?: boolean;
};

export default function PrintConfirmBar({
  confirming = false,
  onConfirm,
  onDecline,
  variant = 'toast',
  plural = true,
}: Props) {
  const label = plural ? 'labels' : 'label';
  const body = (
    <>
      <p className="text-sm font-medium text-foreground">
        Did the {label} print successfully?
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Choose Yes only after {plural ? 'they come' : 'it comes'} out correctly.
        Until then, {plural ? 'these students stay' : 'this student stays'} on Needs label.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          className="gap-1.5"
          disabled={confirming}
          onClick={onConfirm}
        >
          {confirming ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          Yes — mark as printed
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={confirming}
          onClick={onDecline}
        >
          No — keep on Needs label
        </Button>
      </div>
    </>
  );

  if (variant === 'inline') {
    return (
      <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5">
        {body}
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 left-1/2 z-[100] w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 print:hidden rounded-xl border border-border bg-card px-4 py-3 shadow-lg">
      {body}
    </div>
  );
}
