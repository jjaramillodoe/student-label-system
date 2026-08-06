'use client';

import Link from 'next/link';
import { Archive, CheckCircle2, Database, ExternalLink, MapPin, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { studentHasArchiveBoxLocation, studentIsArchived } from '@/lib/cabinets';
import { getStudentStorageDisplay } from '@/lib/studentLocation';
import {
  addressMatchHint,
  addressMatchLabel,
  type AddressMatchKind,
} from '@/lib/addressDuplicate';
import { formatFullName } from '@/lib/personName';

function addressMatchBadgeClass(kind: string): string {
  switch (kind) {
    case 'same_verified':
    case 'same':
      return 'ui-badge-success';
    case 'similar':
      return 'ui-badge-warning';
    case 'different':
      return 'ui-badge-info';
    default:
      return 'ui-badge-muted';
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
  drawerSection?: string;
  cabinetName?: string;
  drawerName?: string;
  archiveBoxId?: string;
  archiveBoxLabel?: string;
  archiveLocation?: string;
  archiveSchoolYear?: string;
  externalId?: string;
  _legacy?: boolean;
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
  /** Resolve Mongo cabinet/drawer IDs to display names */
  cabinetMap?: Record<string, string>;
  drawerMap?: Record<string, string>;
  onUseAsReturning?: (student: IntakeMatchStudent) => void;
  /** ASISTS/legacy only: confirm the person at the desk is this roster row, then continue as NEW */
  onConfirmSameLegacy?: (student: IntakeMatchStudent) => void;
  /** Compact row for search result lists (click whole card to select) */
  onSelect?: (student: IntakeMatchStudent) => void;
  showUseButton?: boolean;
}

export function IntakeArchivedBadge({ student }: { student: IntakeMatchStudent }) {
  if (student._legacy) {
    return (
      <Badge className="text-[10px] bg-violet-700 hover:bg-violet-700 text-white gap-1">
        <Database className="h-3 w-3" />
        ASISTS / Legacy
      </Badge>
    );
  }
  if (!studentIsArchived(student)) {
    return (
      <Badge variant="outline" className="text-[10px]">
        {student.status || 'Active'}
      </Badge>
    );
  }
  return (
    <span className="ui-badge-warning text-[10px]">
      <Archive className="h-3 w-3" />
      Archived
    </span>
  );
}

export default function IntakeMatchCard({
  student,
  cabinetMap = {},
  drawerMap = {},
  onUseAsReturning,
  onConfirmSameLegacy,
  onSelect,
  showUseButton = true,
}: IntakeMatchCardProps) {
  const archived = studentIsArchived(student);
  const legacy = Boolean(student._legacy);
  const storage = getStudentStorageDisplay(student, cabinetMap, drawerMap, {
    showSection: true,
  });
  const hasBox = studentHasArchiveBoxLocation(student);

  const body = (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-sm">
          {formatFullName(student)}
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
        <span className="font-mono">
          ID: {student.labelId || student.studentId || student.externalId || '—'}
        </span>
      </div>
      {legacy ? (
        <p className="mt-1.5 text-xs text-violet-800 dark:text-violet-300">
          Found in the school ASISTS / legacy export. This is not a live file in this system —
          verify before registering as NEW. Use RETURNING only if they already have a record here.
        </p>
      ) : (
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
                {storage.section && ` · Sec: ${storage.section}`}
              </span>
            )}
          </span>
        </div>
      )}
      {!legacy && archived && student.archiveBoxId && (
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
            <span
              title={addressMatchHint(student._addressMatch as AddressMatchKind)}
              className={`${addressMatchBadgeClass(student._addressMatch)} text-[10px]`}
            >
              {addressMatchLabel(student._addressMatch as AddressMatchKind)}
            </span>
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
          legacy
            ? 'border-violet-300 bg-violet-50/70 dark:border-violet-800 dark:bg-violet-950/20'
            : archived
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
        legacy
          ? 'border-violet-300 bg-violet-50/70 dark:border-violet-800 dark:bg-violet-950/20'
          : archived
          ? 'border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/20'
          : 'border-border bg-background/80'
      }`}
    >
      {body}
      {showUseButton && onUseAsReturning && !legacy && (
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
              Same person sitting here — log returning
            </>
          )}
        </Button>
      )}
      {legacy && onConfirmSameLegacy && (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="gap-1.5 mt-1"
          onClick={() => onConfirmSameLegacy(student)}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Same person sitting here — continue as NEW
        </Button>
      )}
      {legacy && !onConfirmSameLegacy && (
        <p className="text-[10px] text-violet-800/90 dark:text-violet-300 flex items-center gap-1">
          <Database className="h-3 w-3" />
          Lookup only — does not open a RETURNING visit by itself.
        </p>
      )}
      {showUseButton && !onUseAsReturning && !legacy && (
        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Switch Student Status to Returning and select this record.
        </p>
      )}
    </div>
  );
}
