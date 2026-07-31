'use client';

import { useEffect, useState } from 'react';
import { Download, Loader2, Printer, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export type RosterStudent = {
  index: number;
  _id: string;
  name: string;
  labelId?: string;
  studentId?: string;
  dob?: string;
  status?: string;
  drawerName?: string;
  drawerSection?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cabinetId: string;
  cabinetName: string;
  drawerId?: string;
  drawerName?: string;
  section?: string;
  onReassign?: (student: RosterStudent) => void;
};

export default function DrawerRosterDialog({
  open,
  onOpenChange,
  cabinetId,
  cabinetName,
  drawerId,
  drawerName,
  section,
  onReassign,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [metaCount, setMetaCount] = useState(0);

  useEffect(() => {
    if (!open || !cabinetId) return;
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (drawerId) params.set('drawerId', drawerId);
    if (section) params.set('section', section);
    fetch(`/api/cabinets/${cabinetId}/roster?${params}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load roster');
        setStudents(Array.isArray(data.students) ? data.students : []);
        setMetaCount(data.count || 0);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [open, cabinetId, drawerId, section]);

  const titleParts = [cabinetName, drawerName, section].filter(Boolean).join(' · ');

  function exportCsv() {
    const params = new URLSearchParams({ format: 'csv' });
    if (drawerId) params.set('drawerId', drawerId);
    if (section) params.set('section', section);
    window.open(`/api/cabinets/${cabinetId}/roster?${params}`, '_blank');
  }

  function printRoster() {
    window.print();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Roster
          </DialogTitle>
          <DialogDescription>{titleParts}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 py-10 text-muted-foreground justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading students…
          </div>
        ) : error ? (
          <p className="text-sm text-destructive py-6">{error}</p>
        ) : (
          <div id="drawer-roster-print" className="space-y-3">
            <div className="flex items-center justify-between gap-2 print:block">
              <p className="text-sm text-muted-foreground">
                {metaCount} student file{metaCount === 1 ? '' : 's'}
              </p>
              <Badge variant="outline" className="print:hidden">
                Sorted A–Z by name
              </Badge>
            </div>
            {students.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No students in this location.
              </p>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Label ID</TableHead>
                      <TableHead>Section</TableHead>
                      <TableHead>Status</TableHead>
                      {onReassign ? <TableHead className="text-right print:hidden">Move</TableHead> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((s) => (
                      <TableRow key={s._id}>
                        <TableCell className="text-xs text-muted-foreground">{s.index}</TableCell>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {s.labelId || s.studentId || '—'}
                        </TableCell>
                        <TableCell className="text-sm">{s.drawerSection || '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{s.status || '—'}</Badge>
                        </TableCell>
                        {onReassign ? (
                          <TableCell className="text-right print:hidden">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onReassign(s)}
                            >
                              Reassign
                            </Button>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 print:hidden">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button variant="outline" className="gap-2" onClick={exportCsv} disabled={loading}>
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Button className="gap-2" onClick={printRoster} disabled={loading || students.length === 0}>
            <Printer className="h-4 w-4" /> Print
          </Button>
        </DialogFooter>

        <style>{`
          @media print {
            body * { visibility: hidden !important; }
            #drawer-roster-print, #drawer-roster-print * { visibility: visible !important; }
            #drawer-roster-print {
              position: absolute !important;
              left: 0; top: 0; width: 100%;
              padding: 0.5in;
            }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}
