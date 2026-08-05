'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FileDown, GripVertical, Loader2, Users } from 'lucide-react';
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
import { formatDrawerSectionLabel, SECTIONS_PER_DRAWER } from '@/lib/drawerSections';
import { downloadDrawerRosterPdf } from '@/lib/drawerRosterPdf';

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
  onSectionChanged?: (message: string) => void;
};

const SECTION_LABELS = Array.from({ length: SECTIONS_PER_DRAWER }, (_, i) =>
  formatDrawerSectionLabel(i + 1),
);

export default function DrawerRosterDialog({
  open,
  onOpenChange,
  cabinetId,
  cabinetName,
  drawerId,
  drawerName,
  section,
  onReassign,
  onSectionChanged,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [metaCount, setMetaCount] = useState(0);
  const [view, setView] = useState<'list' | 'sections'>('list');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const canSectionBoard = Boolean(drawerId);

  const loadRoster = useCallback(() => {
    if (!open || !cabinetId) return;
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (drawerId) params.set('drawerId', drawerId);
    // Section board needs the full drawer; list view can filter
    if (section && view === 'list') params.set('section', section);
    fetch(`/api/cabinets/${cabinetId}/roster?${params}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load roster');
        setStudents(Array.isArray(data.students) ? data.students : []);
        setMetaCount(data.count || 0);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [open, cabinetId, drawerId, section, view]);

  useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  useEffect(() => {
    if (canSectionBoard && !section) setView('sections');
    else setView('list');
  }, [canSectionBoard, section, open]);

  const bySection = useMemo(() => {
    const map: Record<string, RosterStudent[]> = {};
    for (const label of SECTION_LABELS) map[label] = [];
    const unsectioned: RosterStudent[] = [];
    for (const s of students) {
      const key = s.drawerSection || '';
      if (key && map[key]) map[key].push(s);
      else unsectioned.push(s);
    }
    return { map, unsectioned };
  }, [students]);

  const titleParts = [cabinetName, drawerName, section].filter(Boolean).join(' · ');

  function exportCsv() {
    const params = new URLSearchParams({ format: 'csv' });
    if (drawerId) params.set('drawerId', drawerId);
    if (section && view === 'list') params.set('section', section);
    window.open(`/api/cabinets/${cabinetId}/roster?${params}`, '_blank');
  }

  function exportPdf() {
    if (students.length === 0 || pdfBusy) return;
    setPdfBusy(true);
    try {
      downloadDrawerRosterPdf({
        cabinetName,
        drawerName,
        section: section && view === 'list' ? section : undefined,
        students,
      });
    } finally {
      setPdfBusy(false);
    }
  }

  async function moveToSection(studentId: string, targetSection: string) {
    if (!drawerId || !cabinetId) return;
    const student = students.find((s) => s._id === studentId);
    if (!student || student.drawerSection === targetSection) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/cabinets/${cabinetId}/reassign-section`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentIds: [studentId],
          drawerId,
          drawerSection: targetSection,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reassign failed');
      setStudents((prev) =>
        prev.map((s) =>
          s._id === studentId ? { ...s, drawerSection: targetSection } : s,
        ),
      );
      onSectionChanged?.(data.message || `Moved to ${targetSection}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reassign failed');
    } finally {
      setBusy(false);
      setDraggingId(null);
      setDropTarget(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Roster
          </DialogTitle>
          <DialogDescription>{titleParts}</DialogDescription>
        </DialogHeader>

        {canSectionBoard && (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={view === 'sections' ? 'default' : 'outline'}
              onClick={() => setView('sections')}
            >
              By section (drag)
            </Button>
            <Button
              size="sm"
              variant={view === 'list' ? 'default' : 'outline'}
              onClick={() => setView('list')}
            >
              List
            </Button>
            <p className="text-xs text-muted-foreground self-center">
              Drag a student onto a section chip to reassign within this drawer.
            </p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 py-10 text-muted-foreground justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading students…
          </div>
        ) : error ? (
          <p className="text-sm text-destructive py-6">{error}</p>
        ) : view === 'sections' && canSectionBoard ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {metaCount} student file{metaCount === 1 ? '' : 's'}
              {busy ? ' · saving…' : ''}
            </p>
            {bySection.unsectioned.length > 0 && (
              <div
                className="rounded-md border border-dashed p-2 space-y-1"
                onDragOver={(e) => {
                  e.preventDefault();
                }}
              >
                <p className="text-xs font-medium text-muted-foreground">No section</p>
                <div className="flex flex-wrap gap-1">
                  {bySection.unsectioned.map((s) => (
                    <StudentChip
                      key={s._id}
                      student={s}
                      dragging={draggingId === s._id}
                      onDragStart={() => setDraggingId(s._id)}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setDropTarget(null);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {SECTION_LABELS.map((label) => {
                const list = bySection.map[label] || [];
                const active = dropTarget === label;
                return (
                  <div
                    key={label}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDropTarget(label);
                    }}
                    onDragLeave={() => {
                      setDropTarget((t) => (t === label ? null : t));
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const id = e.dataTransfer.getData('text/student-id') || draggingId;
                      if (id) void moveToSection(id, label);
                    }}
                    className={`min-h-[7rem] rounded-md border p-2 space-y-1 transition-colors ${
                      active ? 'border-primary bg-primary/10' : 'bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold">
                        {label.replace('Section ', 'S')}
                      </span>
                      <Badge variant="outline" className="text-[10px] h-5">
                        {list.length}
                      </Badge>
                    </div>
                    <div className="flex flex-col gap-1">
                      {list.map((s) => (
                        <StudentChip
                          key={s._id}
                          student={s}
                          dragging={draggingId === s._id}
                          onDragStart={() => setDraggingId(s._id)}
                          onDragEnd={() => {
                            setDraggingId(null);
                            setDropTarget(null);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {metaCount} student file{metaCount === 1 ? '' : 's'}
              </p>
              <Badge variant="outline">
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
                      {onReassign ? (
                        <TableHead className="text-right">Move</TableHead>
                      ) : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((s) => (
                      <TableRow key={s._id}>
                        <TableCell className="text-xs text-muted-foreground">
                          {s.index}
                        </TableCell>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {s.labelId || s.studentId || '—'}
                        </TableCell>
                        <TableCell className="text-sm">{s.drawerSection || '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{s.status || '—'}</Badge>
                        </TableCell>
                        {onReassign ? (
                          <TableCell className="text-right">
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

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button variant="outline" className="gap-2" onClick={exportCsv} disabled={loading}>
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Button
            className="gap-2"
            onClick={exportPdf}
            disabled={loading || pdfBusy || students.length === 0}
          >
            {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StudentChip({
  student,
  dragging,
  onDragStart,
  onDragEnd,
}: {
  student: RosterStudent;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/student-id', student._id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={`flex items-start gap-1 rounded border bg-background px-1.5 py-1 text-[11px] cursor-grab active:cursor-grabbing ${
        dragging ? 'opacity-50' : ''
      }`}
      title={student.labelId || student.studentId || student.name}
    >
      <GripVertical className="h-3 w-3 shrink-0 mt-0.5 text-muted-foreground" />
      <span className="leading-tight">
        <span className="font-medium">{student.name}</span>
        {(student.labelId || student.studentId) && (
          <span className="block font-mono text-muted-foreground truncate max-w-[9rem]">
            {student.labelId || student.studentId}
          </span>
        )}
      </span>
    </div>
  );
}
