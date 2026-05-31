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
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-yellow-200 dark:bg-yellow-700 text-yellow-900 dark:text-yellow-100 px-6 py-3 rounded shadow-lg flex items-center gap-4 z-50 animate-bounce-in">
      <span>{message}</span>
      <Button
        onClick={onUndo}
        variant="default"
        size="sm"
        className="gap-1 bg-yellow-400 hover:bg-yellow-500"
      >
        <RotateCcw size={16} /> Undo
      </Button>
    </div>
  );
}

