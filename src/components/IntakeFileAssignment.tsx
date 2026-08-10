'use client';

import {
  returningStudentNeedsNewDrawer,
  studentHasArchiveBoxLocation,
  studentIsArchived,
  type NextCabinetSlot,
} from '@/lib/cabinets';
import type { Cabinet } from '@/types/cabinet';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  AlertCircle, Building2, ChevronRight, FolderOpen, Loader2,
} from 'lucide-react';
import { IntakeArchivedFileLocation } from '@/components/IntakeSuccessView';

type Props = {
  intakeStudentStatus: string;
  selectedExistingStudent: any | null;
  cabinets: Cabinet[];
  cabinetsLoading: boolean;
  nextSlot: NextCabinetSlot | null;
};

export default function IntakeFileAssignment({
  intakeStudentStatus,
  selectedExistingStudent,
  cabinets,
  cabinetsLoading,
  nextSlot,
}: Props) {
  if (intakeStudentStatus === 'Other') return null;

  const description =
    selectedExistingStudent && studentIsArchived(selectedExistingStudent)
      ? (studentHasArchiveBoxLocation(selectedExistingStudent)
        ? 'Paperwork stays in archive storage — scan the QR code or open the box link if staff need to add documents.'
        : 'Archived file — box location is not on record. Contact your Data Lead if paperwork is missing.')
      : (selectedExistingStudent && returningStudentNeedsNewDrawer(selectedExistingStudent))
        ? 'No active drawer on file — the next available space will be assigned.'
        : (intakeStudentStatus === 'RETURNING' && selectedExistingStudent)
          ? 'Keeps the existing file — no new space is assigned.'
          : 'Automatically assigned to the next available drawer space.';

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FolderOpen className="h-4 w-4" /> File Assignment
        </CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {(intakeStudentStatus === 'RETURNING' && selectedExistingStudent) ? (
          selectedExistingStudent ? (
            studentIsArchived(selectedExistingStudent) ? (
              <IntakeArchivedFileLocation student={selectedExistingStudent} />
            ) : returningStudentNeedsNewDrawer(selectedExistingStudent) ? (
              cabinetsLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Finding next available slot…
                </div>
              ) : nextSlot ? (
                <div className="rounded-lg border-2 border-dashed border-amber-300/50 bg-amber-50/40 dark:bg-amber-950/20 px-5 py-4 flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40 border border-amber-300/50 flex-shrink-0">
                    <Building2 className="h-5 w-5 text-amber-700 dark:text-amber-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-foreground">
                      {nextSlot.cabinet.identifier
                        ? `${nextSlot.cabinet.name} (${nextSlot.cabinet.identifier})`
                        : nextSlot.cabinet.name}
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                      <ChevronRight className="h-3.5 w-3.5" />
                      <span>Drawer: <strong className="text-foreground">{nextSlot.drawer.name}</strong></span>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0 border-amber-400 text-amber-800 bg-amber-50">
                    New drawer
                  </Badge>
                </div>
              ) : (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>No space available</AlertTitle>
                  <AlertDescription>All cabinets are full. Contact your Data Lead to create new cabinet space.</AlertDescription>
                </Alert>
              )
            ) : (
            (() => {
              const cab = cabinets.find(c => c._id === selectedExistingStudent.cabinet);
              const drw = cab?.drawers.find(d => d._id === selectedExistingStudent.drawer);
              return (
                <div className="rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/30 px-5 py-4 flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 flex-shrink-0">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-foreground">
                      {cab
                        ? (cab.identifier ? `${cab.name} (${cab.identifier})` : cab.name)
                        : 'Existing file location'}
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                      <ChevronRight className="h-3.5 w-3.5" />
                      <span>Drawer: <strong className="text-foreground">{drw?.name ?? selectedExistingStudent.drawer ?? '—'}</strong></span>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">
                    Existing file
                  </Badge>
                </div>
              );
            })()
            )
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
              <AlertCircle className="h-4 w-4" /> Select the existing student above to keep their current file.
            </div>
          )
        ) : cabinetsLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Finding next available slot…
          </div>
        ) : nextSlot ? (
          <div className="rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/30 px-5 py-4 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 flex-shrink-0">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-foreground">
                {nextSlot.cabinet.identifier
                  ? `${nextSlot.cabinet.name} (${nextSlot.cabinet.identifier})`
                  : nextSlot.cabinet.name}
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                <ChevronRight className="h-3.5 w-3.5" />
                <span>Drawer: <strong className="text-foreground">{nextSlot.drawer.name}</strong></span>
                <span className="text-muted-foreground/60">·</span>
                <span>{nextSlot.spacesLeft} space{nextSlot.spacesLeft !== 1 ? 's' : ''} remaining</span>
              </div>
            </div>
            <Badge variant="outline" className="text-xs shrink-0 border-green-300 text-green-700 bg-green-50 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800">
              Auto-assigned
            </Badge>
          </div>
        ) : (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No space available</AlertTitle>
            <AlertDescription>All cabinets are full. Contact your Data Lead to create new cabinet space.</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
