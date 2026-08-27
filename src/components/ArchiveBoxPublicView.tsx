'use client';

import {
  Archive, Boxes, Building2, Calendar, MapPin, Printer, User,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ArchiveBoxPdfButton from '@/components/ArchiveBoxPdfButton';
import { HistoryBackButton, PrintPageButton } from '@/components/PublicRecordActions';
import type { PublicArchiveBoxPayload } from '@/lib/loadPublicArchiveBox';
import { formatFullName } from '@/lib/personName';

export default function ArchiveBoxPublicView({
  data,
  origin,
}: {
  data: PublicArchiveBoxPayload;
  origin: string;
}) {
  const { box, archive, students } = data;
  const cabinetLabel = archive.cabinetIdentifier
    ? `${archive.cabinetName} (${archive.cabinetIdentifier})`
    : archive.cabinetName;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="bg-white dark:bg-gray-900 border-b px-4 py-3 flex items-center gap-3">
        <HistoryBackButton className="shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Archive Box</p>
          <h1 className="text-base font-bold text-gray-900 dark:text-gray-100 truncate">{box.label}</h1>
        </div>
        <PrintPageButton className="gap-1.5 shrink-0" />
        <Button variant="outline" size="sm" className="gap-1.5 shrink-0" asChild>
          <Link href={`/archive/box/${box._id}/label`}>
            <Printer size={14} /> Box label
          </Link>
        </Button>
        <ArchiveBoxPdfButton
          variant="outline"
          className="gap-1.5 shrink-0 h-9 px-3 text-sm"
          box={box}
          archive={archive}
          students={students}
          origin={origin}
        />
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
              <Boxes className="h-6 w-6 text-amber-700 dark:text-amber-300" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{box.label}</h2>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                <Badge variant="secondary" className="text-xs">
                  <Archive className="h-3 w-3 mr-1" /> Archived
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {box.currentCount}/{box.maxCapacity} files
                </Badge>
              </div>
            </div>
          </div>

          <div className="space-y-3 text-sm border-t pt-4">
            <div className="flex items-start gap-3">
              <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">From Cabinet</p>
                <p className="font-medium">{cabinetLabel}</p>
                {archive.school && <p className="text-muted-foreground text-xs mt-0.5">{archive.school}</p>}
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">School Year</p>
                <p className="font-medium">{archive.schoolYear}</p>
                <p className="text-muted-foreground text-xs mt-0.5">Archived {archive.archiveDate}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Storage Location</p>
                <p className="font-medium">{archive.location}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <User className="h-4 w-4" /> Student Files
            </h3>
            <Badge variant="outline">{students.length}</Badge>
          </div>
          {students.length === 0 ? (
            <p className="px-5 py-8 text-sm text-muted-foreground text-center">No student files assigned to this box yet.</p>
          ) : (
            <ul className="divide-y">
              {students.map(s => (
                <li key={s._id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{formatFullName(s)}</p>
                    <p className="text-xs text-muted-foreground font-mono">{s.labelId || s.studentId || '—'}</p>
                  </div>
                  <Link
                    href={`/student/${s.labelId || s.studentId}`}
                    className="text-xs text-primary hover:underline shrink-0"
                  >
                    View
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 pb-4">
          Adult Education Archive Box · Scanned from box label
        </p>
      </div>
    </div>
  );
}
