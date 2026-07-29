'use client';

import Link from 'next/link';
import { Archive, CheckCircle2, ExternalLink, MapPin, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { studentHasArchiveBoxLocation, studentIsArchived } from '@/lib/cabinets';
import { getStudentStorageDisplay } from '@/lib/studentLocation';
import {
  addressMatchHint,
  addressMatchLabel,
  type AddressMatchKind,
} from '@/lib/addressDuplicate';

function addressMatchBadgeClass(kind: string): string {
  switch (kind) {
    case 'same_verified':
    case 'same':
      return 'border-green-400 text-green-800 bg-green-50 dark:text-green-300';
    case 'similar':
      return 'border-amber-400 text-amber-800 bg-amber-50 dark:text-amber-300';
    case 'different':
      return 'border-sky-400 text-sky-800 bg-sky-50 dark:text-sky-300';
    default:
      return '';
  }
}

export type IntakeMatchStudent = {
  _id?: string;
  firstName?: string;
  lastName?: string;
  dob?: string;
  labelId?: string;
  studentId?: string;
  status?: string;
  archived?: boolean;
  cabinet?: string;
  drawer?: string;
  archiveBoxId?: string;
  archiveBoxLabel?: string;
  archiveLocation?: string;
  archiveSchoolYear?: string;
  _dobMismatch?: boolean;
  _similarity?: number;
  _addressDriven?: boolean;
  _addressMatch?: string;
  _addressExisting?: string;
  _addressIncoming?: string;
  _addressExistingVerified?: boolean;
};

interface IntakeMatchCardProps {
  student: IntakeMatchStudent;
  onUseAsReturning?: (student: IntakeMatchStudent) => void;
  /** Compact row for search result lists (click whole card to select) */
  onSelect?: (student: IntakeMatchStudent) => void;
  showUseButton?: boolean;
}

export function IntakeArchivedBadge({ student }: { student: IntakeMatchStudent }) {
  if (!studentIsArchived(student)) {
    return (
      <Badge variant="outline" className="text-[10px]">
        {student.status || 'Active'}
      </Badge>
    );
  }
  return (
    <Badge className="text-[10px] bg-amber-600 hover:bg-amber-600 text-white gap-1">
      <Archive className="h-3 w-3" />
      Archived
    </Badge>
  );
}

export default function IntakeMatchCard({
  student,
  onUseAsReturning,
  onSelect,
  showUseButton = true,
}: IntakeMatchCardProps) {
  const archived = studentIsArchived(student);
  const storage = getStudentStorageDisplay(student);
  const hasBox = studentHasArchiveBoxLocation(student);

  const body = (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-sm">
          {student.firstName} {student.lastName}
        </span>
        <IntakeArchivedBadge student={student} />
        {student._dobMismatch && (
          <Badge variant="outline" className="text-[10px]">Diff. DOB</Badge>
        )}
        {student._similarity != null && !student._dobMismatch && (
          <Badge variant="outline" className="text-[10px]">{student._similarity}% match</Badge>
        )}
        {student._addressDriven && (
          <Badge variant="outline" className="text-[10px]">Same address</Badge>
        )}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        <span>DOB: {student.dob || '—'}</span>
        <span className="font-mono">ID: {student.labelId || student.studentId || '—'}</span>
      </div>
      <div className="mt-1.5 flex items-start gap-1.5 text-xs">
        <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
        <span>
          {archived ? (
            <>
              <span className="font-medium text-amber-800 dark:text-amber-300">
                {storage.primaryLabel}: {storage.primary}
              </span>
              {storage.secondary !== '—' && (
                <span className="text-muted-foreground"> · {storage.secondary}</span>
              )}
              {!hasBox && (
                <span className="block text-[10px] text-amber-700 dark:text-amber-400 mt-0.5">
                  No archive box on record — ask your Data Lead if paperwork is needed.
                </span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground">
              {storage.primaryLabel}: {storage.primary}
              {storage.secondary !== '—' && ` · ${storage.secondaryLabel}: ${storage.secondary}`}
            </span>
          )}
        </span>
      </div>
      {archived && student.archiveBoxId && (
        <Link
          href={`/archive/box/${student.archiveBoxId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-primary mt-1.5 hover:underline"
          onClick={e => e.stopPropagation()}
        >
          <ExternalLink className="h-3 w-3" />
          Open archive box page
        </Link>
      )}
      {student._addressMatch && (
        <div className="text-xs space-y-1 border-t border-dashed pt-2 mt-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              variant="outline"
              title={addressMatchHint(student._addressMatch as AddressMatchKind)}
              className={`text-[10px] ${addressMatchBadgeClass(student._addressMatch)}`}
            >
              {addressMatchLabel(student._addressMatch as AddressMatchKind)}
            </Badge>
            {student._addressExistingVerified && (
              <span className="text-[10px] text-muted-foreground">NYC verified on file</span>
            )}
          </div>
          {student._addressExisting && (
            <p className="text-muted-foreground">
              <span className="text-foreground/80">On file:</span> {student._addressExisting}
            </p>
          )}
          {student._addressIncoming && student._addressMatch === 'different' && (
            <p className="text-muted-foreground">
              <span className="text-foreground/80">New entry:</span> {student._addressIncoming}
            </p>
          )}
          {student._addressMatch === 'different' && (
            <p className="text-[10px] text-sky-700 dark:text-sky-300 italic">
              Address changed — confirm with the student (possible move or sibling at a new home).
            </p>
          )}
        </div>
      )}
    </>
  );

  if (onSelect) {
    return (
      <button
        type="button"
        onClick={() => onSelect(student)}
        className={`w-full text-left rounded-md border px-3 py-2.5 transition-colors hover:bg-accent ${
          archived
            ? 'border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/20'
            : 'border-border bg-background'
        }`}
      >
        {body}
      </button>
    );
  }

  return (
    <div
      className={`rounded-md border px-3 py-2.5 text-sm space-y-2 ${
        archived
          ? 'border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/20'
          : 'border-border bg-background/80'
      }`}
    >
      {body}
      {showUseButton && onUseAsReturning && (
        <Button
          type="button"
          size="sm"
          className="gap-1.5 mt-1"
          onClick={() => onUseAsReturning(student)}
        >
          {archived ? (
            <>
              <Archive className="h-3.5 w-3.5" />
              Same person — log returning (archived file)
            </>
          ) : (
            <>
              <RotateCcw className="h-3.5 w-3.5" />
              Same person — log returning visit
            </>
          )}
        </Button>
      )}
      {showUseButton && !onUseAsReturning && (
        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Switch Student Status to Returning and select this record.
        </p>
      )}
    </div>
  );
}
