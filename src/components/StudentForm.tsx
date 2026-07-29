'use client';

import { useState, useEffect } from 'react';
import { Cabinet } from '@/types/cabinet';
import { useSession } from 'next-auth/react';
import { Search, X, CheckCircle2, AlertCircle } from 'lucide-react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { sanitizeUsaNameInput, usaNameError, USA_NAME_HINT } from '@/lib/usaName';

interface StudentFormProps {
  onSubmit: (formData: any, onSuccess?: () => void, onError?: (msg: string) => void) => void;
  loading: boolean;
  initialData?: any;
  toast?: { message: string; type: 'success' | 'error' } | null;
  clearForm?: boolean;
}

const FISCAL_YEAR_OPTIONS = [
  '2024-2025', '2025-2026', '2026-2027', '2027-2028'
];

export default function StudentForm({ onSubmit, loading, initialData, toast, clearForm }: StudentFormProps) {
  const { status } = useSession();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    dob: "",
    fiscalYear: "",
    status: "",
    startDate: "",
    cabinet: "",
    drawer: "",
    email: "",
    phone: "",
  });

  const [cabinets, setCabinets] = useState<Cabinet[]>([]);
  const [filteredCabinets, setFilteredCabinets] = useState<Cabinet[]>([]);
  const [showCabinetDropdown, setShowCabinetDropdown] = useState(false);
  const [cabinetSearch, setCabinetSearch] = useState('');
  const [selectedDrawer, setSelectedDrawer] = useState<{ _id: string; name: string; capacity: number; currentCount: number } | null>(null);
  const [selectedCabinetName, setSelectedCabinetName] = useState('');
  const [selectedDrawerName, setSelectedDrawerName] = useState('');
  const [nameError, setNameError] = useState('');

  useEffect(() => {
    if (initialData) {
      setForm(initialData);
    }
  }, [initialData]);

  useEffect(() => {
    if (clearForm) {
      handleClear();
    }
  }, [clearForm]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    async function fetchCabinets() {
      try {
        const res = await fetch('/api/cabinets');
        if (!res.ok) throw new Error('Failed to fetch cabinets');
        const data = await res.json();
        setCabinets(data);
      } catch (err) {
        console.error('Error fetching cabinets:', err);
      }
    }
    fetchCabinets();
  }, [status]);

  useEffect(() => {
    if (cabinetSearch) {
      const filtered = cabinets.filter(cabinet =>
        cabinet.name.toLowerCase().includes(cabinetSearch.toLowerCase())
      );
      setFilteredCabinets(filtered);
      setShowCabinetDropdown(true);
    } else {
      setFilteredCabinets([]);
      setShowCabinetDropdown(false);
    }
  }, [cabinetSearch, cabinets]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-cabinet-dropdown]')) {
        setShowCabinetDropdown(false);
      }
    };

    if (showCabinetDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showCabinetDropdown]);

  const handleCabinetSelect = (cabinet: Cabinet) => {
    setForm(prev => ({ ...prev, cabinet: cabinet._id }));
    setSelectedCabinetName(cabinet.name);
    setCabinetSearch(cabinet.name);
    setShowCabinetDropdown(false);
  };

  const handleDrawerSelect = (drawer: { _id: string; name: string; capacity: number; currentCount: number }) => {
    setSelectedDrawer(drawer);
    setSelectedDrawerName(drawer.name);
    setForm(prev => ({ ...prev, drawer: drawer._id }));
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'cabinet') {
      setCabinetSearch(value);
      setShowCabinetDropdown(true);
      setForm(prev => ({ ...prev, [name]: value }));
    } else if (name === 'firstName' || name === 'lastName') {
      setForm(prev => ({ ...prev, [name]: sanitizeUsaNameInput(value) }));
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const firstErr = usaNameError(form.firstName, 'First name');
    const lastErr = usaNameError(form.lastName, 'Last name');
    if (firstErr || lastErr) {
      setNameError(firstErr || lastErr || USA_NAME_HINT);
      return;
    }
    setNameError('');
    onSubmit(form);
  };

  const handleClear = () => {
    setForm({
      firstName: "",
      lastName: "",
      dob: "",
      fiscalYear: "",
      status: "",
      startDate: "",
      cabinet: "",
      drawer: "",
      email: "",
      phone: "",
    });
    setCabinetSearch("");
    setSelectedDrawer(null);
    setSelectedCabinetName("");
    setSelectedDrawerName("");
  };

  const selectedCabinet = cabinets.find(c => c._id === form.cabinet);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {toast && (
        <Alert variant={toast.type === 'success' ? 'success' : 'destructive'}>
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription className="font-medium">
              {toast.message}
            </AlertDescription>
          </div>
        </Alert>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="firstName">
            First Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="firstName"
            name="firstName"
            value={form.firstName}
            onChange={onChange}
            placeholder="Enter first name"
            required
            spellCheck={false}
            autoComplete="given-name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="lastName">
            Last Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="lastName"
            name="lastName"
            value={form.lastName}
            onChange={onChange}
            placeholder="Enter last name"
            required
            spellCheck={false}
            autoComplete="family-name"
          />
        </div>

        <p className="md:col-span-2 text-xs text-muted-foreground -mt-2">
          {USA_NAME_HINT}
        </p>
        {nameError && (
          <p className="md:col-span-2 text-xs text-destructive -mt-2">{nameError}</p>
        )}

        <div className="space-y-2">
          <Label htmlFor="dob">
            Date of Birth <span className="text-destructive">*</span>
          </Label>
          <Input
            id="dob"
            name="dob"
            type="date"
            value={form.dob}
            onChange={onChange}
            required
          />
          <p className="text-xs text-muted-foreground">Format: YYYY-MM-DD</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="fiscalYear">
            Fiscal Year <span className="text-destructive">*</span>
          </Label>
          <Select
            value={form.fiscalYear}
            onValueChange={(value) => setForm(prev => ({ ...prev, fiscalYear: value }))}
            required
          >
            <SelectTrigger id="fiscalYear">
              <SelectValue placeholder="Select Fiscal Year" />
            </SelectTrigger>
            <SelectContent>
              {FISCAL_YEAR_OPTIONS.map(year => (
                <SelectItem key={year} value={year}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">
            Status <span className="text-destructive">*</span>
          </Label>
          <Select
            value={form.status}
            onValueChange={(value) => setForm(prev => ({ ...prev, status: value }))}
            required
          >
            <SelectTrigger id="status">
              <SelectValue placeholder="Select Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
              <SelectItem value="Graduated">Graduated</SelectItem>
              <SelectItem value="Withdrawn">Withdrawn</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Transferred">Transferred</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="startDate">
            Start Date <span className="text-destructive">*</span>
          </Label>
          <Input
            id="startDate"
            name="startDate"
            type="date"
            value={form.startDate}
            onChange={onChange}
            required
          />
          <p className="text-xs text-muted-foreground">Format: YYYY-MM-DD</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cabinet">
            Cabinet <span className="text-destructive">*</span>
          </Label>
          <div className="relative" data-cabinet-dropdown>
            <Input
              id="cabinet"
              name="cabinet"
              value={cabinetSearch}
              onChange={onChange}
              placeholder="Search for a cabinet..."
              required
              onFocus={() => {
                if (cabinetSearch) {
                  setShowCabinetDropdown(true);
                }
              }}
              className="pr-10"
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            {showCabinetDropdown && filteredCabinets.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-auto">
                {filteredCabinets.map((cabinet) => (
                  <div
                    key={cabinet._id}
                    className="p-3 hover:bg-accent cursor-pointer border-b border-border last:border-b-0 transition-colors"
                    onClick={() => handleCabinetSelect(cabinet)}
                  >
                    <div className="font-medium text-foreground">
                      {cabinet.identifier ? `${cabinet.name} (${cabinet.identifier})` : cabinet.name}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Available: {cabinet.totalCapacity - cabinet.currentCount} / {cabinet.totalCapacity} spaces
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="drawer">
            Drawer <span className="text-destructive">*</span>
          </Label>
          <Select
            value={selectedDrawerName}
            onValueChange={(value) => {
              const drawer = selectedCabinet?.drawers.find(d => d.name === value);
              if (drawer) handleDrawerSelect(drawer);
            }}
            disabled={!selectedCabinet}
            required
          >
            <SelectTrigger id="drawer">
              <SelectValue placeholder={selectedCabinet ? "Select Drawer" : "Select a cabinet first"} />
            </SelectTrigger>
            <SelectContent>
              {selectedCabinet?.drawers.map((drawer) => (
                <SelectItem key={drawer._id} value={drawer.name}>
                  {drawer.name} ({drawer.capacity - drawer.currentCount} / {drawer.capacity} spaces)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedDrawer && (
            <p className="text-xs text-muted-foreground">
              Available spaces: {selectedDrawer.capacity - selectedDrawer.currentCount}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email (Optional)</Label>
          <Input
            id="email"
            name="email"
            type="email"
            value={form.email}
            onChange={onChange}
            placeholder="Enter email address"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone (Optional)</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            value={form.phone}
            onChange={onChange}
            placeholder="Enter phone number"
          />
        </div>
      </div>

      <div className="flex gap-3 justify-end pt-4 border-t border-border">
        <Button
          type="button"
          variant="outline"
          onClick={handleClear}
          disabled={loading}
        >
          <X className="mr-2 h-4 w-4" />
          Clear
        </Button>
        <Button
          type="submit"
          disabled={loading}
        >
          {loading ? (
            <>
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
              Saving...
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Save Student
            </>
          )}
        </Button>
      </div>
    </form>
  );
} 