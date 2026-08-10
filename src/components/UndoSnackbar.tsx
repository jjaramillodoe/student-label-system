'use client';

import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';

interface UndoSnackbarProps {
  open: boolean;
  onUndo: () => void;
  message?: string;
}

export default function UndoSnackbar({
  open,
  onUndo,
  message = 'Student(s) deleted.',
}: UndoSnackbarProps) {
  if (!open) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-50 flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-lg">
      <span className="text-sm text-foreground">{message}</span>
      <Button onClick={onUndo} variant="outline" size="sm" className="gap-1.5 shrink-0">
        <RotateCcw size={14} /> Undo
      </Button>
    </div>
  );
}
