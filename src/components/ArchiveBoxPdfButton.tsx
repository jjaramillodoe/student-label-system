'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadArchiveBoxPdf, type ArchiveBoxPdfInput } from '@/lib/archiveBoxPdf';

type ArchiveBoxPdfButtonProps = ArchiveBoxPdfInput & {
  className?: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  disabled?: boolean;
};

export default function ArchiveBoxPdfButton({
  box,
  archive,
  students,
  origin,
  className,
  variant = 'outline',
  disabled,
}: ArchiveBoxPdfButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      await downloadArchiveBoxPdf({ box, archive, students, origin });
    } catch (error) {
      console.error('Failed to generate archive box PDF:', error);
      window.alert('Could not generate PDF. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      className={`gap-2 ${className ?? ''}`}
      disabled={disabled || loading}
      onClick={handleDownload}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      Download PDF
    </Button>
  );
}
