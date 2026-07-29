'use client';

import Link from 'next/link';
import { FileSearch, ScanLine, Upload, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StudentEmptyStateProps {
  userRole?: string;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onFocusSearch?: () => void;
}

export default function StudentEmptyState({
  userRole,
  hasActiveFilters,
  onClearFilters,
  onFocusSearch,
}: StudentEmptyStateProps) {
  const canIntake = ['Admin', 'Data Lead'].includes(userRole || '');
  const canUpload = ['Admin', 'Data Lead', 'Data Member'].includes(userRole || '');

  return (
    <div className="rounded-lg border border-dashed bg-muted/20 px-6 py-12 text-center">
      <FileSearch className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
      <h3 className="text-base font-semibold text-foreground">No students found</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
        {hasActiveFilters
          ? 'Nothing matches your current filters. Clear them or try scanning a label.'
          : 'No students loaded yet. Add students via intake or bulk upload.'}
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {hasActiveFilters && (
          <Button variant="outline" size="sm" className="gap-2" onClick={onClearFilters}>
            <X className="h-4 w-4" />
            Clear filters
          </Button>
        )}
        <Button variant="outline" size="sm" className="gap-2" onClick={onFocusSearch}>
          <ScanLine className="h-4 w-4" />
          Scan / search label
        </Button>
        {canUpload && (
          <Button variant="outline" size="sm" className="gap-2" asChild>
            <Link href="/admin/students/bulk-upload">
              <Upload className="h-4 w-4" />
              Bulk upload
            </Link>
          </Button>
        )}
        {canIntake && (
          <Button size="sm" className="gap-2" asChild>
            <Link href="/intake">
              <UserPlus className="h-4 w-4" />
              Open Intake
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
