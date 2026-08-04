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
    <div className="ui-empty-surface ui-enter">
      <div className="relative z-10 space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border bg-background/80 shadow-sm">
          <FileSearch className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="space-y-1.5">
          <p className="ui-eyebrow">Students</p>
          <h3 className="text-lg font-semibold tracking-tight text-foreground">
            No students found
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            {hasActiveFilters
              ? 'Nothing matches your current filters. Clear them or try scanning a label.'
              : 'No students loaded yet. Add students via Intake or bulk upload.'}
          </p>
        </div>
        <div className="pt-1 flex flex-wrap items-center justify-center gap-2 ui-enter ui-enter-delay-1">
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
    </div>
  );
}
