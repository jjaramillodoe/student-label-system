'use client';

import { useState, useEffect } from 'react';
import { Cabinet } from '@/types/cabinet';
import { Edit } from 'lucide-react';
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
import { sanitizeUsaNameInput, usaNameError, USA_NAME_HINT } from '@/lib/usaName';
import { fiscalYearOptions, STUDENT_STATUS_OPTIONS } from '@/lib/studentOptions';

const FISCAL_YEAR_OPTIONS = fiscalYearOptions();
const STATUS_OPTIONS = STUDENT_STATUS_OPTIONS;

interface EditStudentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: any;
  cabinets: Cabinet[];
  onSave: (formData: any) => void;
  getCabinetDisplayName: (cabinet: Cabinet) => string;
}

export default function EditStudentModal({
  open,
  onOpenChange,
  student,
  cabinets,
  onSave,
  getCabinetDisplayName,
}: EditStudentModalProps) {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    dob: '',
    fiscalYear: '',
    status: '',
    startDate: '',
    cabinet: '',
    drawer: '',
    email: '',
    phone: '',
    middleInitial: '',
    homePhone: '',
    cellPhone: '',
  });
  const [nameError, setNameError] = useState('');

  useEffect(() => {
    if (student && open) {
      setForm({
        firstName: student.firstName || '',
        lastName: student.lastName || '',
        dob: student.dob || '',
        fiscalYear: student.fiscalYear || '',
        status: student.status || '',
        startDate: student.startDate || '',
        cabinet: student.cabinet || '',
        drawer: student.drawer || '',
        email: student.email || '',
        phone: student.homePhone || student.phone || '',
        middleInitial: student.middleInitial || '',
        homePhone: student.homePhone || student.phone || '',
        cellPhone: student.cellPhone || '',
      });
    }
  }, [student, open]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    if (name === 'firstName' || name === 'lastName') {
      setForm(prev => ({ ...prev, [name]: sanitizeUsaNameInput(value) }));
      setNameError('');
      return;
    }
    setForm(prev => ({ ...prev, [name]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const firstErr = usaNameError(form.firstName, 'First name');
    const lastErr = usaNameError(form.lastName, 'Last name');
    if (firstErr || lastErr) {
      setNameError(firstErr || lastErr || USA_NAME_HINT);
      return;
    }
    setNameError('');
    onSave({
      ...form,
      phone: form.homePhone.trim() || form.phone.trim() || '',
      homePhone: form.homePhone.trim() || form.phone.trim() || '',
      cellPhone: form.cellPhone.trim() || '',
      middleInitial: form.middleInitial.trim() || '',
    });
  }

  const selectedCabinet = cabinets.find(c => c._id === form.cabinet);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Edit className="h-6 w-6" />
            Edit Student
          </DialogTitle>
          <DialogDescription>
            Update student information. Fields marked with * are required.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="edit-firstName">
                    First Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="edit-firstName"
                    name="firstName"
                    value={form.firstName}
                    onChange={handleChange}
                    placeholder="Enter first name"
                    required
                    spellCheck={false}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-lastName">
                    Last Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="edit-lastName"
                    name="lastName"
                    value={form.lastName}
                    onChange={handleChange}
                    placeholder="Enter last name"
                    required
                    spellCheck={false}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-middleInitial">Middle Initial</Label>
                  <Input
                    id="edit-middleInitial"
                    name="middleInitial"
                    value={form.middleInitial}
                    onChange={(e) => {
                      const next = e.target.value.replace(/[^A-Za-z]/g, '').slice(0, 1).toUpperCase();
                      setForm((prev) => ({ ...prev, middleInitial: next }));
                    }}
                    placeholder="M"
                    maxLength={1}
                    className="uppercase"
                  />
                </div>

                <p className="md:col-span-2 text-xs text-muted-foreground -mt-2">
                  {USA_NAME_HINT}
                </p>
                {nameError && (
                  <p className="md:col-span-2 text-xs text-destructive -mt-2">{nameError}</p>
                )}

                <div className="space-y-2">
                  <Label htmlFor="edit-dob">
                    Date of Birth <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="edit-dob"
                    name="dob"
                    type="date"
                    value={form.dob}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="Enter email address"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-homePhone">Home Phone</Label>
                  <Input
                    id="edit-homePhone"
                    name="homePhone"
                    type="tel"
                    value={form.homePhone}
                    onChange={(e) => setForm((prev) => ({
                      ...prev,
                      homePhone: e.target.value,
                      phone: e.target.value,
                    }))}
                    placeholder="Enter home phone"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-cellPhone">Cell Phone</Label>
                  <Input
                    id="edit-cellPhone"
                    name="cellPhone"
                    type="tel"
                    value={form.cellPhone}
                    onChange={handleChange}
                    placeholder="Enter cell phone"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-fiscalYear">
                    Fiscal Year <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={form.fiscalYear}
                    onValueChange={(value) => setForm(prev => ({ ...prev, fiscalYear: value }))}
                    required
                  >
                    <SelectTrigger id="edit-fiscalYear">
                      <SelectValue placeholder="Select fiscal year" />
                    </SelectTrigger>
                    <SelectContent>
                      {FISCAL_YEAR_OPTIONS.map(year => (
                        <SelectItem key={year} value={year}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-status">
                    Status <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={form.status}
                    onValueChange={(value) => setForm(prev => ({ ...prev, status: value }))}
                    required
                  >
                    <SelectTrigger id="edit-status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(status => (
                        <SelectItem key={status} value={status}>{status}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-startDate">
                    Start Date <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="edit-startDate"
                    name="startDate"
                    type="date"
                    value={form.startDate}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-cabinet">
                    Cabinet <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={form.cabinet}
                    onValueChange={(value) => setForm(prev => ({ ...prev, cabinet: value, drawer: '' }))}
                    required
                  >
                    <SelectTrigger id="edit-cabinet">
                      <SelectValue placeholder="Select cabinet" />
                    </SelectTrigger>
                    <SelectContent>
                      {cabinets.map(cabinet => (
                        <SelectItem key={cabinet._id} value={cabinet._id}>
                          {getCabinetDisplayName(cabinet)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-drawer">
                    Drawer <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={form.drawer}
                    onValueChange={(value) => setForm(prev => ({ ...prev, drawer: value }))}
                    required
                    disabled={!form.cabinet}
                  >
                    <SelectTrigger id="edit-drawer">
                      <SelectValue placeholder={form.cabinet ? "Select drawer" : "Select cabinet first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedCabinet?.drawers.map(drawer => (
                        <SelectItem key={drawer._id} value={drawer._id}>
                          {drawer.name} ({drawer.currentCount}/{drawer.capacity})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

