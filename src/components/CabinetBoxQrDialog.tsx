'use client';

import { Loader2, Printer, QrCode } from 'lucide-react';
import ArchiveBoxLabelSheet from '@/components/ArchiveBoxLabelSheet';
import ArchiveBoxPdfButton from '@/components/ArchiveBoxPdfButton';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getBoxPublicUrl, type BoxLabelStudent } from '@/lib/boxLabel';
import type { CabinetArchiveRecord, PhysicalArchiveBox } from '@/types/cabinet';

export default function CabinetBoxQrDialog({
  open,
  onOpenChange,
  box,
  archive,
  students,
  loading,
  origin,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  box: PhysicalArchiveBox | null;
  archive: CabinetArchiveRecord | null;
  students: BoxLabelStudent[];
  loading: boolean;
  origin: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" /> Box Label — QR + Student List
          </DialogTitle>
          <DialogDescription>
            Print and attach to the physical box. The QR opens a public page with this box location and file list — no login required.
          </DialogDescription>
        </DialogHeader>
        {box && archive && (
          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Loading student list…
              </div>
            ) : (
              <ArchiveBoxLabelSheet
                box={box}
                archive={{
                  cabinetName: archive.cabinetName,
                  cabinetIdentifier: archive.cabinetIdentifier,
                  school: archive.school,
                  schoolYear: archive.schoolYear,
                  location: archive.location,
                  archiveDate: archive.archiveDate,
                }}
                students={students}
                origin={origin}
              />
            )}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                className="flex-1 gap-2"
                disabled={loading}
                onClick={() => window.print()}
              >
                <Printer className="h-4 w-4" /> Print Label
              </Button>
              <ArchiveBoxPdfButton
                className="flex-1 gap-2"
                disabled={loading}
                box={box}
                archive={{
                  cabinetName: archive.cabinetName,
                  cabinetIdentifier: archive.cabinetIdentifier,
                  school: archive.school,
                  schoolYear: archive.schoolYear,
                  location: archive.location,
                  archiveDate: archive.archiveDate,
                }}
                students={students}
                origin={origin}
              />
              <Button variant="outline" className="flex-1 gap-2" asChild disabled={loading}>
                <a
                  href={getBoxPublicUrl(box._id, origin)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open public page
                </a>
              </Button>
              <Button variant="outline" className="flex-1 gap-2" asChild disabled={loading}>
                <a
                  href={`/archive/box/${box._id}/label`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Full print view
                </a>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
