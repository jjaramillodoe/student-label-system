'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Users } from 'lucide-react';
import { fiscalYearOptions, STUDENT_STATUS_OPTIONS } from '@/lib/studentOptions';

const FISCAL_YEAR_OPTIONS = fiscalYearOptions();
const STATUS_OPTIONS = STUDENT_STATUS_OPTIONS;

interface BulkUpdateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (data: { status?: string; fiscalYear?: string }) => void;
  selectedCount: number;
}

export default function BulkUpdateModal({
  open,
  onOpenChange,
  onUpdate,
  selectedCount,
}: BulkUpdateModalProps) {
  const [form, setForm] = useState({
    status: '',
    fiscalYear: '',
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const updateData: { status?: string; fiscalYear?: string } = {};
    if (form.status) updateData.status = form.status;
    if (form.fiscalYear) updateData.fiscalYear = form.fiscalYear;
    onUpdate(updateData);
    setForm({ status: '', fiscalYear: '' });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Bulk Update
          </DialogTitle>
          <DialogDescription>
            Update {selectedCount} selected student{selectedCount !== 1 ? 's' : ''}. Leave fields empty to skip.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bulk-status">Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(value) => setForm(prev => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger id="bulk-status">
                      <SelectValue placeholder="Select status (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {STATUS_OPTIONS.map(status => (
                        <SelectItem key={status} value={status}>{status}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bulk-fiscalYear">Fiscal Year</Label>
                  <Select
                    value={form.fiscalYear}
                    onValueChange={(value) => setForm(prev => ({ ...prev, fiscalYear: value }))}
                  >
                    <SelectTrigger id="bulk-fiscalYear">
                      <SelectValue placeholder="Select fiscal year (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {FISCAL_YEAR_OPTIONS.map(year => (
                        <SelectItem key={year} value={year}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!form.status && !form.fiscalYear}>
              Update {selectedCount} Student{selectedCount !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

