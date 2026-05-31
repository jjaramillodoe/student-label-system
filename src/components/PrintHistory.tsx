'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, Search, X, Printer, User, FileText, RotateCcw } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface PrintHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReprint?: (studentIds: string[]) => void;
}

export default function PrintHistory({ open, onOpenChange, onReprint }: PrintHistoryProps) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    userId: '',
    studentId: '',
    limit: '100'
  });

  useEffect(() => {
    if (open) {
      fetchHistory();
    }
  }, [open, filters]);

  async function fetchHistory() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.userId) params.append('userId', filters.userId);
      if (filters.studentId) params.append('studentId', filters.studentId);
      if (filters.limit) params.append('limit', filters.limit);

      const res = await fetch(`/api/print-history?${params.toString()}`);
      const data = await res.json();
      setHistory(data);
    } catch (error) {
      console.error('Failed to fetch print history:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Print History
          </DialogTitle>
          <DialogDescription>
            View and filter print history logs
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="space-y-2">
            <Label htmlFor="startDate">Start Date</Label>
            <Input
              id="startDate"
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endDate">End Date</Label>
            <Input
              id="endDate"
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="studentId">Student ID</Label>
            <Input
              id="studentId"
              placeholder="Filter by student ID"
              value={filters.studentId}
              onChange={(e) => setFilters({ ...filters, studentId: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="limit">Limit</Label>
            <Select
              value={filters.limit}
              onValueChange={(value) => setFilters({ ...filters, limit: value })}
            >
              <SelectTrigger id="limit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="250">250</SelectItem>
                <SelectItem value="500">500</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No print history found</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date/Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>Labels</TableHead>
                  <TableHead>Layout</TableHead>
                  {onReprint && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((log, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-mono text-xs">
                      {new Date(log.time).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{log.user?.name || 'Unknown'}</div>
                          <div className="text-xs text-muted-foreground">{log.user?.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {log.students?.slice(0, 3).map((s: any, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {s.firstName} {s.lastName}
                          </Badge>
                        ))}
                        {log.students?.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{log.students.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge>{log.labelCount || log.students?.length || 0}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.layout || 'N/A'}</Badge>
                    </TableCell>
                    {onReprint && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const studentIds = log.students?.map((s: any) => s.studentId) || [];
                            if (studentIds.length > 0) {
                              onReprint(studentIds);
                            }
                          }}
                          className="gap-2"
                        >
                          <Printer className="h-4 w-4" />
                          Reprint
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

