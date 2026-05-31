'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Printer, History, Clock, User } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';

interface ReprintButtonProps {
  onReprint: (studentIds: string[]) => void;
  onReprintLast?: () => void;
}

export default function ReprintButton({ onReprint, onReprintLast }: ReprintButtonProps) {
  const [open, setOpen] = useState(false);
  const [recentPrints, setRecentPrints] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      fetchRecentPrints();
    }
  }, [open]);

  async function fetchRecentPrints() {
    setLoading(true);
    try {
      const res = await fetch('/api/print-history?limit=10');
      const data = await res.json();
      setRecentPrints(data);
    } catch (error) {
      console.error('Failed to fetch recent prints:', error);
    } finally {
      setLoading(false);
    }
  }

  function toggleStudent(studentId: string) {
    setSelectedStudents(prev => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  }

  function handleReprint() {
    const studentIds = Array.from(selectedStudents);
    if (studentIds.length > 0) {
      onReprint(studentIds);
      setOpen(false);
      setSelectedStudents(new Set());
    }
  }

  function handleReprintLast() {
    if (recentPrints.length > 0) {
      const lastPrint = recentPrints[0];
      const studentIds = lastPrint.students?.map((s: any) => s.studentId) || [];
      if (studentIds.length > 0) {
        onReprint(studentIds);
        setOpen(false);
      }
    }
  }

  // Get all unique students from recent prints
  const allStudents = recentPrints.flatMap((print: any) => 
    (print.students || []).map((s: any) => ({
      ...s,
      printTime: print.time,
      printLayout: print.layout
    }))
  );

  // Group by studentId to show most recent print
  const studentMap = new Map();
  allStudents.forEach((student: any) => {
    if (!studentMap.has(student.studentId) || 
        new Date(student.printTime) > new Date(studentMap.get(student.studentId).printTime)) {
      studentMap.set(student.studentId, student);
    }
  });

  const uniqueStudents = Array.from(studentMap.values());

  return (
    <>
      <div className="flex gap-2">
        {onReprintLast && recentPrints.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleReprintLast}
            className="gap-2"
          >
            <History className="h-4 w-4" />
            Reprint Last
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className="gap-2"
        >
          <Printer className="h-4 w-4" />
          Reprint from History
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Reprint from History
            </DialogTitle>
            <DialogDescription>
              Select students from recent prints to reprint their labels
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : uniqueStudents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No recent prints found</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedStudents.size === uniqueStudents.length && uniqueStudents.length > 0}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedStudents(new Set(uniqueStudents.map((s: any) => s.studentId)));
                            } else {
                              setSelectedStudents(new Set());
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Student ID</TableHead>
                      <TableHead>Last Printed</TableHead>
                      <TableHead>Layout</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {uniqueStudents.map((student: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Checkbox
                            checked={selectedStudents.has(student.studentId)}
                            onCheckedChange={() => toggleStudent(student.studentId)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {student.firstName} {student.lastName}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {student.studentId}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(student.printTime).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{student.printLayout || 'N/A'}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-between items-center mt-4">
                <div className="text-sm text-muted-foreground">
                  {selectedStudents.size} student(s) selected
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleReprint}
                    disabled={selectedStudents.size === 0}
                    className="gap-2"
                  >
                    <Printer className="h-4 w-4" />
                    Reprint Selected ({selectedStudents.size})
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

