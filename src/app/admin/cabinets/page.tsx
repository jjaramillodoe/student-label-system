'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Cabinet, ArchiveBox, CabinetArchiveRecord, PhysicalArchiveBox } from '@/types/cabinet';
import ArchiveBoxLabelSheet from '@/components/ArchiveBoxLabelSheet';
import ArchiveBoxPdfButton from '@/components/ArchiveBoxPdfButton';
import { getBoxPublicUrl, type BoxLabelStudent } from '@/lib/boxLabel';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  ArrowLeft, 
  Building2, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Archive,
  Boxes,
  Gauge,
  ArrowDownUp,
  HelpCircle,
  PackageOpen,
  MapPin,
  CalendarDays,
  Minus,
  Info,
  QrCode,
  Printer,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

interface SchoolOption {
  name: string;
  active: boolean;
}

function boxQuantityForFiles(studentCount: number, filesPerBox: number): number {
  if (filesPerBox <= 0) return 1;
  if (studentCount <= 0) return 1;
  return Math.max(1, Math.ceil(studentCount / filesPerBox));
}

function suggestArchiveBoxes(studentCount: number): ArchiveBox[] {
  const filesPerBox = 200;
  return [{ quantity: boxQuantityForFiles(studentCount, filesPerBox), filesPerBox }];
}

export default function CabinetsPage() {
  const { data: session, status } = useSession();
  const userSchool: string = (session?.user as any)?.school || '';
  const isAdmin: boolean = (session?.user as any)?.role === 'Admin';
  const [cabinets, setCabinets] = useState<Cabinet[]>([]);
  const [configuredSchools, setConfiguredSchools] = useState<SchoolOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [editingCabinet, setEditingCabinet] = useState<Cabinet | null>(null);
  const [form, setForm] = useState({
    name: '',
    identifier: '',
    school: '',
    drawers: [{ name: '', capacity: 0 }]
  });
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [auditResults, setAuditResults] = useState<any[]>([]);
  const [syncMessage, setSyncMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [schoolFilter, setSchoolFilter] = useState<string>('all');
  const [capacityFilter, setCapacityFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name');
  const syncTimeout = useRef<NodeJS.Timeout | null>(null);

  // ── Archive state ──────────────────────────────────────────────────────────
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [archivingCabinet, setArchivingCabinet] = useState<Cabinet | null>(null);
  const [archivingLoading, setArchivingLoading] = useState(false);
  const currentYear = new Date().getFullYear();
  const FISCAL_YEAR_OPTIONS = [
    `${currentYear - 1}-${currentYear}`,
    `${currentYear}-${currentYear + 1}`,
    `${currentYear + 1}-${currentYear + 2}`,
  ];
  const BOX_PRESETS = [50, 100, 200];
  const [archiveForm, setArchiveForm] = useState<{
    schoolYear: string;
    boxes: ArchiveBox[];
    location: string;
    archiveDate: string;
    notes: string;
  }>({
    schoolYear: FISCAL_YEAR_OPTIONS[0],
    boxes: [{ quantity: 1, filesPerBox: 100 }],
    location: '',
    archiveDate: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [archiveRecords, setArchiveRecords] = useState<Record<string, CabinetArchiveRecord>>({});
  const [archivePending, setArchivePending] = useState<Record<string, number>>({});
  const [assigningCabinetId, setAssigningCabinetId] = useState<string | null>(null);
  const [boxQrOpen, setBoxQrOpen] = useState(false);
  const [boxLabelStudents, setBoxLabelStudents] = useState<BoxLabelStudent[]>([]);
  const [boxLabelLoading, setBoxLabelLoading] = useState(false);
  const [boxLabelOrigin, setBoxLabelOrigin] = useState('');
  const [selectedBox, setSelectedBox] = useState<PhysicalArchiveBox | null>(null);
  const [selectedBoxArchive, setSelectedBoxArchive] = useState<CabinetArchiveRecord | null>(null);
  const [endOfYearCloseout, setEndOfYearCloseout] = useState(false);

  function openArchiveModal(cabinet: Cabinet) {
    const studentCount = cabinet.currentCount || 0;
    const isPartial = studentCount < (cabinet.totalCapacity || 0);
    setArchivingCabinet(cabinet);
    setEndOfYearCloseout(!isPartial);
    setArchiveForm({
      schoolYear: FISCAL_YEAR_OPTIONS[0],
      boxes: suggestArchiveBoxes(studentCount),
      location: '',
      archiveDate: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setArchiveModalOpen(true);
  }

  function addArchiveBox() {
    setArchiveForm(f => ({ ...f, boxes: [...f.boxes, { quantity: 1, filesPerBox: 100 }] }));
  }

  function removeArchiveBox(i: number) {
    setArchiveForm(f => ({ ...f, boxes: f.boxes.filter((_, idx) => idx !== i) }));
  }

  function updateArchiveBox(i: number, field: keyof ArchiveBox, value: number) {
    setArchiveForm(f => ({
      ...f,
      boxes: f.boxes.map((b, idx) => idx === i ? { ...b, [field]: value } : b),
    }));
  }

  function setArchiveBoxPreset(i: number, filesPerBox: number) {
    const studentCount = archivingCabinet?.currentCount || 0;
    const quantity = boxQuantityForFiles(studentCount, filesPerBox);
    setArchiveForm(f => ({
      ...f,
      boxes: f.boxes.map((b, idx) =>
        idx === i ? { filesPerBox, quantity } : b,
      ),
    }));
  }

  function setArchiveBoxCustomSize(i: number, filesPerBox: number) {
    const safeSize = Math.max(1, filesPerBox || 1);
    const studentCount = archivingCabinet?.currentCount || 0;
    const quantity = boxQuantityForFiles(studentCount, safeSize);
    setArchiveForm(f => ({
      ...f,
      boxes: f.boxes.map((b, idx) =>
        idx === i ? { filesPerBox: safeSize, quantity } : b,
      ),
    }));
  }

  const archiveStudentCount = archivingCabinet?.currentCount || 0;
  const archiveTotalFiles = archiveForm.boxes.reduce(
    (sum, b) => sum + b.quantity * b.filesPerBox,
    0,
  );

  async function handleArchiveSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!archivingCabinet) return;

    const isPartial =
      (archivingCabinet.currentCount || 0) < (archivingCabinet.totalCapacity || 0);
    if (isPartial && !endOfYearCloseout) {
      setError('Turn on end-of-year closeout to archive a cabinet that is not full.');
      return;
    }

    if (archiveTotalFiles < (archivingCabinet.currentCount || 0)) {
      setError(
        `Add enough archive boxes for all ${archivingCabinet.currentCount} student file(s). Current box layout holds ${archiveTotalFiles}.`,
      );
      return;
    }

    setArchivingLoading(true);
    try {
      const res = await fetch(`/api/cabinets/${archivingCabinet._id}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(archiveForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to archive cabinet');
        return;
      }
      setArchiveModalOpen(false);
      setArchivingCabinet(null);
      setEndOfYearCloseout(false);
      await fetchCabinets();
      setSyncMessage(
        `Cabinet "${archivingCabinet.name}" archived for ${archiveForm.schoolYear}. ` +
        `${data.boxCount ?? archiveForm.boxes.length} box(es), ${data.studentsAssigned ?? 0} student file(s) moved → ${archiveForm.location}.`
      );
      if (syncTimeout.current) clearTimeout(syncTimeout.current);
      syncTimeout.current = setTimeout(() => setSyncMessage(''), 8000);
    } catch {
      setError('Failed to archive cabinet');
    } finally {
      setArchivingLoading(false);
    }
  }

  async function handleAssignStudentsToBoxes(cabinetId: string) {
    setAssigningCabinetId(cabinetId);
    try {
      const res = await fetch(`/api/cabinets/${cabinetId}/archive/assign-students`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to move students to archive boxes');
        return;
      }
      await fetchCabinets();
      setSyncMessage(
        data.assigned > 0
          ? `Assigned ${data.assigned} student file(s) to archive boxes.`
          : 'All student files are already synced to archive boxes.',
      );
      if (syncTimeout.current) clearTimeout(syncTimeout.current);
      syncTimeout.current = setTimeout(() => setSyncMessage(''), 8000);
    } catch {
      setError('Failed to move students to archive boxes');
    } finally {
      setAssigningCabinetId(null);
    }
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBoxLabelOrigin(window.location.origin);
    }
  }, []);

  function openBoxQr(box: PhysicalArchiveBox, record: CabinetArchiveRecord) {
    setSelectedBox(box);
    setSelectedBoxArchive(record);
    setBoxLabelStudents([]);
    setBoxQrOpen(true);
    setBoxLabelLoading(true);
    fetch(`/api/archive/box?boxId=${encodeURIComponent(box._id)}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => setBoxLabelStudents(data?.students ?? []))
      .catch(() => setBoxLabelStudents([]))
      .finally(() => setBoxLabelLoading(false));
  }

  async function loadArchiveRecords(cabinetList: Cabinet[]) {
    const archived = cabinetList.filter(c => c.status === 'Archived');
    if (archived.length === 0) {
      setArchiveRecords({});
      setArchivePending({});
      return;
    }
    const entries = await Promise.all(
      archived.map(async c => {
        try {
          const [archiveRes, pendingRes] = await Promise.all([
            fetch(`/api/cabinets/${c._id}/archive`),
            fetch(`/api/cabinets/${c._id}/archive/assign-students`),
          ]);
          if (!archiveRes.ok) return null;
          const records: CabinetArchiveRecord[] = await archiveRes.json();
          let pending = c.currentCount || 0;
          if (pendingRes.ok) {
            const pendingData = await pendingRes.json();
            pending = pendingData.pending ?? pending;
          }
          return records[0]
            ? { id: c._id!, record: records[0], pending } as const
            : null;
        } catch {
          return null;
        }
      }),
    );
    const recordMap: Record<string, CabinetArchiveRecord> = {};
    const pendingMap: Record<string, number> = {};
    for (const entry of entries) {
      if (entry) {
        recordMap[entry.id] = entry.record;
        pendingMap[entry.id] = entry.pending;
      }
    }
    setArchiveRecords(recordMap);
    setArchivePending(pendingMap);
  }

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetchCabinets();
    fetchSchoolOptions();
  }, [status]);

  const fetchCabinets = async () => {
    try {
      const res = await fetch('/api/cabinets');
      if (!res.ok) throw new Error('Failed to fetch cabinets');
      const data = await res.json();
      setCabinets(data);
      await loadArchiveRecords(data);
    } catch (err) {
      setError('Failed to load cabinets');
    } finally {
      setLoading(false);
    }
  };

  const fetchSchoolOptions = async () => {
    try {
      const res = await fetch('/api/admin/schools');
      if (!res.ok) return;
      const data = await res.json();
      setConfiguredSchools(Array.isArray(data) ? data : []);
    } catch (err) {
      setConfiguredSchools([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const totalCapacity = form.drawers.reduce((sum, drawer) => sum + drawer.capacity, 0);
      const payload = {
        ...form,
        totalCapacity,
        currentCount: 0
      };

      const url = editingCabinet ? `/api/cabinets/${editingCabinet._id}` : '/api/cabinets';
      const method = editingCabinet ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to save cabinet');
      
      await fetchCabinets();
      setIsModalOpen(false);
      setForm({ name: '', identifier: '', school: userSchool, drawers: [{ name: '', capacity: 0 }] });
      setEditingCabinet(null);
    } catch (err) {
      setError('Failed to save cabinet');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this cabinet?')) return;
    
    try {
      const res = await fetch(`/api/cabinets/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete cabinet');
      await fetchCabinets();
    } catch (err) {
      setError('Failed to delete cabinet');
    }
  };

  const addDrawer = () => {
    setForm(prev => ({
      ...prev,
      drawers: [...prev.drawers, { name: '', capacity: 0 }]
    }));
  };

  const removeDrawer = (index: number) => {
    setForm(prev => ({
      ...prev,
      drawers: prev.drawers.filter((_, i) => i !== index)
    }));
  };

  const updateDrawer = (index: number, field: 'name' | 'capacity', value: string | number) => {
    setForm(prev => ({
      ...prev,
      drawers: prev.drawers.map((drawer, i) => 
        i === index ? { ...drawer, [field]: value } : drawer
      )
    }));
  };

  const handleSmartSuggest = () => {
    if (editingCabinet) return; // Don't suggest when editing
    
    const commonNames = ['Main Cabinet', 'Storage Cabinet', 'Archive Cabinet', 'Records Cabinet', 'Files Cabinet'];
    const drawerNames = ['Drawer A', 'Drawer B', 'Drawer C', 'Drawer D', 'Drawer E'];
    const defaultCapacity = 100;
    const defaultDrawerCount = 5;
    
    // Find a cabinet name that doesn't exist yet
    let suggestedName = commonNames[0];
    for (const name of commonNames) {
      const exists = cabinets.some(c => c.name === name && (!c.identifier || c.identifier === ''));
      if (!exists) {
        suggestedName = name;
        break;
      }
    }
    
    // If all common names exist, suggest with identifier
    let suggestedIdentifier = '';
    if (cabinets.some(c => c.name === suggestedName)) {
      // Find next available identifier (A, B, C, etc.)
      const existingIdentifiers = cabinets
        .filter(c => c.name === suggestedName)
        .map(c => c.identifier || '')
        .filter(Boolean);
      
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      for (let i = 0; i < letters.length; i++) {
        if (!existingIdentifiers.includes(letters[i])) {
          suggestedIdentifier = letters[i];
          break;
        }
      }
    }
    
    // Suggest school - use user's school if available, otherwise most common school
    let suggestedSchool = (session?.user as any)?.school || '';
    if (!suggestedSchool && cabinets.length > 0) {
      const schoolCounts: Record<string, number> = {};
      cabinets.forEach(c => {
        if (c.school) {
          schoolCounts[c.school] = (schoolCounts[c.school] || 0) + 1;
        }
      });
      const mostCommonSchool = Object.entries(schoolCounts).sort((a, b) => b[1] - a[1])[0];
      suggestedSchool = mostCommonSchool ? mostCommonSchool[0] : (configuredSchools.find(school => school.active)?.name || 'School 1');
    } else if (!suggestedSchool) {
      suggestedSchool = configuredSchools.find(school => school.active)?.name || 'School 1';
    }
    
    // Generate drawers with suggested names and capacity
    const suggestedDrawers = Array.from({ length: defaultDrawerCount }, (_, i) => ({
      name: drawerNames[i] || `Drawer ${String.fromCharCode(65 + i)}`,
      capacity: defaultCapacity
    }));
    
    setForm({
      name: suggestedName,
      identifier: suggestedIdentifier,
      school: suggestedSchool,
      drawers: suggestedDrawers
    });
  };

  const handleAudit = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/cabinets/audit');
      const data = await res.json();
      setAuditResults(data.invalid || []);
      setAuditModalOpen(true);
    } catch (err) {
      setError('Failed to audit student assignments');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setLoading(true);
    setError('');
    setSyncMessage('');
    try {
      const res = await fetch('/api/cabinets/sync', { method: 'POST' });
      
      // Read as text first so unexpected server responses can produce a useful message.
      const text = await res.text();
      
      if (!text) {
        throw new Error(`Empty response from server (${res.status} ${res.statusText})`);
      }
      
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        throw new Error(`Invalid JSON response: ${text.substring(0, 200)}`);
      }
      
      if (!res.ok) {
        throw new Error(data.error || data.details || `Server error: ${res.status} ${res.statusText}`);
      }
      
      if (data.success) {
        const message = data.message || `Cabinet/drawer counts synced! (${data.updated || 0} cabinets updated)`;
        setSyncMessage(message);
        if (data.warning && data.skipped && data.skipped.length > 0) {
          console.warn('Some cabinets were skipped:', data.skipped);
        }
        fetchCabinets();
        if (syncTimeout.current) clearTimeout(syncTimeout.current);
        syncTimeout.current = setTimeout(() => setSyncMessage(''), 6000);
      } else {
        throw new Error(data.error || data.details || 'Failed to sync cabinet/drawer counts');
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to sync cabinet/drawer counts';
      setError(errorMessage);
      console.error('Sync error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoCreateCabinet = async (sourceCabinet: Cabinet) => {
    const usagePercent = sourceCabinet.totalCapacity > 0 
      ? Math.round((sourceCabinet.currentCount / sourceCabinet.totalCapacity) * 100) 
      : 0;
    const overCapacity = Math.max(0, sourceCabinet.currentCount - sourceCabinet.totalCapacity);
    
    const confirmMessage = overCapacity > 0
      ? `Create a new cabinet similar to "${sourceCabinet.name}" for ${sourceCabinet.school || 'the same school'} and automatically move ${overCapacity} over-capacity student(s) to it?`
      : `Create a new cabinet similar to "${sourceCabinet.name}" for ${sourceCabinet.school || 'the same school'}?`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Get existing cabinets for the same school to generate a unique identifier
      const schoolCabinets = cabinets.filter(c => c.school === sourceCabinet.school);
      const existingIdentifiers = schoolCabinets
        .map(c => c.identifier)
        .filter((id): id is string => Boolean(id))
        .map(id => parseInt(id))
        .filter(num => !isNaN(num));
      
      const maxIdentifier = existingIdentifiers.length > 0 ? Math.max(...existingIdentifiers) : 0;
      const newIdentifier = String(maxIdentifier + 1).padStart(4, '0');

      // Create new cabinet with same structure but new identifier
      const totalCapacity = sourceCabinet.drawers.reduce((sum, drawer) => sum + drawer.capacity, 0);
      const payload = {
        name: sourceCabinet.name,
        identifier: newIdentifier,
        school: sourceCabinet.school || '',
        drawers: sourceCabinet.drawers.map(d => ({ 
          name: d.name.replace(/\d+/, (match) => {
            // Try to increment drawer numbers if they contain digits
            const num = parseInt(match);
            return isNaN(num) ? match : String(num + 1);
          }).replace(/A$/, 'B').replace(/B$/, 'C').replace(/C$/, 'D') || d.name,
          capacity: d.capacity 
        })),
        totalCapacity,
        currentCount: 0
      };

      const createRes = await fetch('/api/cabinets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!createRes.ok) {
        const data = await createRes.json();
        throw new Error(data.error || 'Failed to create new cabinet');
      }

      const newCabinet = await createRes.json();
      let moveMessage = `Successfully created new cabinet "${sourceCabinet.name} (${newIdentifier})" for ${sourceCabinet.school}`;

      // Move over-capacity students to the new cabinet
      if (overCapacity > 0 && newCabinet._id) {
        try {
          const moveRes = await fetch('/api/cabinets/move-students', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fromCabinetId: sourceCabinet._id,
              toCabinetId: newCabinet._id
            }),
          });

          if (moveRes.ok) {
            const moveData = await moveRes.json();
            moveMessage += `. ${moveData.message}`;
            if (moveData.results?.skipped > 0) {
              moveMessage += ` (${moveData.results.skipped} skipped due to errors)`;
            }
          } else {
            const moveData = await moveRes.json();
            moveMessage += `. Warning: Failed to move students - ${moveData.error || 'Unknown error'}`;
          }
        } catch (moveError: any) {
          moveMessage += `. Warning: Failed to move students - ${moveError.message}`;
        }
      }

      // Refresh cabinets list
      await fetchCabinets();
      setError('');
      setSyncMessage(moveMessage);
      if (syncTimeout.current) clearTimeout(syncTimeout.current);
      syncTimeout.current = setTimeout(() => setSyncMessage(''), 8000);
    } catch (err: any) {
      setError(err.message || 'Failed to auto-create cabinet');
    } finally {
      setLoading(false);
    }
  };

  const getUsagePercent = (cabinet: Cabinet) => (
    cabinet.totalCapacity > 0
      ? Math.round((cabinet.currentCount / cabinet.totalCapacity) * 100)
      : 0
  );

  const getCapacityStatus = (usagePercent: number) => {
    if (usagePercent > 100) return { label: 'Over capacity', variant: 'destructive' as const };
    if (usagePercent >= 100) return { label: 'Full', variant: 'destructive' as const };
    if (usagePercent >= 80) return { label: 'Near full', variant: 'secondary' as const };
    return { label: 'Available', variant: 'outline' as const };
  };

  // Get unique schools from cabinets
  const uniqueSchools = Array.from(new Set(cabinets.map(c => c.school).filter((s): s is string => Boolean(s)))).sort();
  const schoolOptions = Array.from(new Set([
    (session?.user as any)?.school,
    ...configuredSchools.filter(school => school.active).map(school => school.name),
    ...uniqueSchools
  ].filter((school): school is string => Boolean(school)))).sort();

  const cabinetStats = cabinets.reduce(
    (stats, cabinet) => {
      const usagePercent = getUsagePercent(cabinet);
      stats.totalCapacity += cabinet.totalCapacity || 0;
      stats.currentCount += cabinet.currentCount || 0;
      if (usagePercent >= 80 && usagePercent <= 100) stats.needsAttention += 1;
      if (usagePercent > 100) stats.overCapacity += 1;
      return stats;
    },
    { totalCapacity: 0, currentCount: 0, needsAttention: 0, overCapacity: 0 }
  );
  const availableCapacity = cabinetStats.totalCapacity - cabinetStats.currentCount;

  const filteredCabinets = cabinets.filter(cabinet => {
    const query = searchQuery.toLowerCase();
    const usagePercent = getUsagePercent(cabinet);
    const matchesSearch = (
      cabinet.name.toLowerCase().includes(query) ||
      cabinet.identifier?.toLowerCase().includes(query) ||
      cabinet.school?.toLowerCase().includes(query)
    );
    const matchesSchool = schoolFilter === 'all' || cabinet.school === schoolFilter;
    const matchesCapacity =
      capacityFilter === 'all' ||
      (capacityFilter === 'available' && usagePercent < 80) ||
      (capacityFilter === 'nearFull' && usagePercent >= 80 && usagePercent < 100) ||
      (capacityFilter === 'full' && usagePercent === 100) ||
      (capacityFilter === 'overCapacity' && usagePercent > 100);
    return matchesSearch && matchesSchool && matchesCapacity;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'usageHigh':
        return getUsagePercent(b) - getUsagePercent(a);
      case 'usageLow':
        return getUsagePercent(a) - getUsagePercent(b);
      case 'capacityHigh':
        return (b.totalCapacity || 0) - (a.totalCapacity || 0);
      case 'school':
        return (a.school || '').localeCompare(b.school || '') || a.name.localeCompare(b.name);
      default:
        return a.name.localeCompare(b.name);
    }
  });

  if (loading && cabinets.length === 0) {
    return (
      <div className="w-full p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-foreground">Cabinet Management</h1>
          <p className="text-muted-foreground mt-2">
            Manage cabinets, drawers, and storage assignments
          </p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <Button variant="outline" onClick={() => setHelpModalOpen(true)} className="gap-2">
            <HelpCircle className="h-4 w-4" />
            How to Create
          </Button>
          <Button
            onClick={() => {
              setEditingCabinet(null);
              setForm(prev => ({ name: '', identifier: '', school: userSchool || prev.school, drawers: [{ name: '', capacity: 0 }] }));
              setIsModalOpen(true);
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Cabinet
          </Button>
        </div>
      </div>

      <Separator />

      {/* Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Cabinets</p>
                <p className="text-2xl font-bold">{cabinets.length}</p>
              </div>
              <Archive className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Stored Files</p>
                <p className="text-2xl font-bold">{cabinetStats.currentCount}</p>
              </div>
              <Boxes className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Available Space</p>
                <p className={`text-2xl font-bold ${availableCapacity < 0 ? 'text-destructive' : ''}`}>
                  {availableCapacity}
                </p>
              </div>
              <Gauge className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Needs Attention</p>
                <p className={`text-2xl font-bold ${cabinetStats.overCapacity > 0 ? 'text-destructive' : ''}`}>
                  {cabinetStats.needsAttention + cabinetStats.overCapacity}
                </p>
              </div>
              <AlertCircle className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions and Search */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-4 flex-1 flex-wrap">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search cabinets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="w-full sm:w-[200px]">
              <Select value={schoolFilter} onValueChange={setSchoolFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by school" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Schools</SelectItem>
                  {uniqueSchools.map(school => (
                    <SelectItem key={school} value={school}>
                      {school}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-[200px]">
              <Select value={capacityFilter} onValueChange={setCapacityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Capacity status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="nearFull">Near Full</SelectItem>
                  <SelectItem value="full">Full</SelectItem>
                  <SelectItem value="overCapacity">Over Capacity</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-[220px]">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <ArrowDownUp className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Sort cabinets" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="school">School</SelectItem>
                  <SelectItem value="usageHigh">Usage: High to Low</SelectItem>
                  <SelectItem value="usageLow">Usage: Low to High</SelectItem>
                  <SelectItem value="capacityHigh">Capacity: High to Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
          <Button
            onClick={handleAudit}
            variant="outline"
            className="gap-2"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            Audit Assignments
          </Button>
          <Button
            onClick={handleSync}
            variant="outline"
            className="gap-2"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Sync Counts
          </Button>
          </div>
        </div>
        {(schoolFilter !== 'all' || capacityFilter !== 'all') && (
          <div className="flex items-center gap-2 flex-wrap">
            {schoolFilter !== 'all' && (
              <Badge variant="secondary" className="gap-2">
                School: {schoolFilter}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 hover:bg-transparent"
                  onClick={() => setSchoolFilter('all')}
                >
                  ×
                </Button>
              </Badge>
            )}
            {capacityFilter !== 'all' && (
              <Badge variant="secondary" className="gap-2">
                Capacity: {capacityFilter.replace(/([A-Z])/g, ' $1').toLowerCase()}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 hover:bg-transparent"
                  onClick={() => setCapacityFilter('all')}
                >
                  ×
                </Button>
              </Badge>
            )}
            <span className="text-sm text-muted-foreground">
              Showing {filteredCabinets.length} of {cabinets.length} cabinets
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSchoolFilter('all');
                setCapacityFilter('all');
              }}
            >
              Clear filters
            </Button>
          </div>
        )}
      </div>

      {cabinetStats.overCapacity > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{cabinetStats.overCapacity} cabinet(s) over capacity</AlertTitle>
          <AlertDescription>
            Use the Over Capacity filter to review cabinets that need student files moved.
          </AlertDescription>
        </Alert>
      )}

      {/* Success Message */}
      {syncMessage && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertTitle className="text-green-800 dark:text-green-200">Success!</AlertTitle>
          <AlertDescription className="text-green-700 dark:text-green-300">
            {syncMessage}
          </AlertDescription>
        </Alert>
      )}

      {/* Error Message */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Cabinets Grid */}
      {filteredCabinets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {searchQuery ? 'No cabinets found' : 'No cabinets yet'}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery
                ? 'Try adjusting your search query'
                : 'Get started by creating your first cabinet'}
            </p>
            {!searchQuery && (
              <Button
                onClick={() => {
                  setEditingCabinet(null);
                  setForm(prev => ({ name: '', identifier: '', school: userSchool || prev.school, drawers: [{ name: '', capacity: 0 }] }));
                  setIsModalOpen(true);
                }}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Cabinet
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCabinets.map(cabinet => {
            const usagePercent = cabinet.totalCapacity > 0 
              ? Math.round((cabinet.currentCount / cabinet.totalCapacity) * 100) 
              : 0;
            const isFull = usagePercent >= 100;
            const isNearFull = usagePercent >= 80;
            const capacityStatus = getCapacityStatus(usagePercent);

            return (
              <Card key={cabinet._id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                        {cabinet.name}
                      </CardTitle>
                      {cabinet.identifier && (
                        <Badge variant="secondary" className="mt-1">
                          {cabinet.identifier}
                        </Badge>
                      )}
                      <Badge variant={capacityStatus.variant} className="mt-1 ml-1">
                        {capacityStatus.label}
                      </Badge>
                    </div>
                    <div className="flex gap-1 items-center">
                      {cabinet.status === 'Archived' ? (
                        <Badge className="bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700 text-xs">
                          <Archive className="h-3 w-3 mr-1" /> Archived
                        </Badge>
                      ) : (
                        <Button
                          variant={isFull ? 'default' : 'outline'}
                          size="sm"
                          title="Archive this cabinet at end of school year (full or partial)"
                          onClick={() => openArchiveModal(cabinet)}
                          className={
                            isFull
                              ? 'gap-1.5 bg-amber-600 hover:bg-amber-700 text-white border-amber-600'
                              : 'gap-1.5 border-amber-300 text-amber-800 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950/30'
                          }
                        >
                          <Archive className="h-4 w-4" />
                          Archive
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingCabinet(cabinet);
                          setForm({
                            name: cabinet.name,
                            identifier: cabinet.identifier || '',
                            school: cabinet.school || '',
                            drawers: cabinet.drawers.map(d => ({ name: d.name, capacity: d.capacity }))
                          });
                          setIsModalOpen(true);
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(cabinet._id!)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  {cabinet.school && (
                    <CardDescription>{cabinet.school}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Over-capacity warning */}
                  {usagePercent > 100 && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Over Capacity!</AlertTitle>
                      <AlertDescription className="mt-2">
                        This cabinet is {usagePercent}% full and exceeds its capacity by {cabinet.currentCount - cabinet.totalCapacity} files.
                        <div className="mt-2 text-sm font-semibold">
                          {cabinet.currentCount - cabinet.totalCapacity} student(s) need to be moved to a new cabinet.
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3 w-full"
                          onClick={() => handleAutoCreateCabinet(cabinet)}
                          disabled={loading}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          {loading ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Creating & Moving...
                            </>
                          ) : (
                            <>
                              Create New Cabinet & Move {cabinet.currentCount - cabinet.totalCapacity} Student(s)
                            </>
                          )}
                        </Button>
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Capacity</span>
                      <span className={`font-medium ${usagePercent > 100 ? 'text-destructive' : ''}`}>
                        {cabinet.currentCount} / {cabinet.totalCapacity} files
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2 relative overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          usagePercent > 100
                            ? 'bg-destructive'
                            : isFull
                            ? 'bg-destructive'
                            : isNearFull
                            ? 'bg-yellow-500'
                            : 'bg-primary'
                        }`}
                        style={{ 
                          width: `${Math.min(usagePercent, 100)}%`,
                          position: 'relative',
                          zIndex: 1
                        }}
                      />
                      {usagePercent > 100 && (
                        <>
                          <div 
                            className="absolute inset-0 bg-destructive/50 rounded-full border-r-2 border-destructive" 
                            style={{ width: '100%' }}
                          />
                          <div className="absolute top-0 right-0 h-2 w-2 bg-destructive rounded-full animate-pulse" />
                        </>
                      )}
                    </div>
                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                      <span className={usagePercent > 100 ? 'text-destructive font-semibold' : ''}>
                        {usagePercent}% used
                      </span>
                      <span className={usagePercent > 100 ? 'text-destructive font-semibold' : ''}>
                        {cabinet.totalCapacity - cabinet.currentCount >= 0 
                          ? `${cabinet.totalCapacity - cabinet.currentCount} available`
                          : `${Math.abs(cabinet.totalCapacity - cabinet.currentCount)} over capacity`
                        }
                      </span>
                    </div>
                  </div>

                  <Separator />

                  {cabinet.status === 'Archived' ? (
                    <div>
                      {archiveRecords[cabinet._id!] ? (
                        <>
                          <div className="rounded-lg border bg-amber-50/50 dark:bg-amber-950/20 p-3 mb-3 space-y-1 text-sm">
                            <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-medium">
                              <MapPin className="h-4 w-4" /> {archiveRecords[cabinet._id!].location}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {archiveRecords[cabinet._id!].schoolYear} · Archived {archiveRecords[cabinet._id!].archiveDate}
                            </p>
                          </div>

                          <div className="mb-3 space-y-2">
                            {(archivePending[cabinet._id!] ?? 0) > 0 && (
                              <Alert>
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Students need box assignment</AlertTitle>
                                <AlertDescription>
                                  {archivePending[cabinet._id!]} student file(s) are not linked to an archive box yet.
                                </AlertDescription>
                              </Alert>
                            )}
                            <Button
                              variant={(archivePending[cabinet._id!] ?? 0) > 0 ? 'default' : 'outline'}
                              size="sm"
                              className={(archivePending[cabinet._id!] ?? 0) > 0
                                ? 'w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white'
                                : 'w-full gap-2'}
                              disabled={assigningCabinetId === cabinet._id}
                              onClick={() => handleAssignStudentsToBoxes(cabinet._id!)}
                            >
                              {assigningCabinetId === cabinet._id ? (
                                <><Loader2 className="h-4 w-4 animate-spin" /> Assigning...</>
                              ) : (archivePending[cabinet._id!] ?? 0) > 0 ? (
                                <><Boxes className="h-4 w-4" /> Move {archivePending[cabinet._id!]} Student(s) to Boxes</>
                              ) : (
                                <><Boxes className="h-4 w-4" /> Sync Students to Boxes</>
                              )}
                            </Button>
                            <p className="text-[11px] text-muted-foreground text-center">
                              Links student files to archive boxes so Location shows on the dashboard.
                            </p>
                          </div>

                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-semibold flex items-center gap-1.5">
                              <Boxes className="h-4 w-4 text-amber-600" /> Archive Boxes
                            </h4>
                            <Badge variant="outline">
                              {(archiveRecords[cabinet._id!].physicalBoxes || []).length}
                            </Badge>
                          </div>
                          <div className="space-y-2">
                            {(archiveRecords[cabinet._id!].physicalBoxes || []).map(box => {
                              const boxUsage = box.maxCapacity > 0
                                ? Math.round((box.currentCount / box.maxCapacity) * 100)
                                : 0;
                              return (
                                <div key={box._id} className="flex items-center justify-between text-sm p-2 bg-amber-50/40 dark:bg-amber-950/10 rounded border border-amber-200/50 dark:border-amber-800/30">
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium truncate">{box.label}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {box.currentCount}/{box.maxCapacity} files
                                      {box.drawerName && box.drawerName !== box.label && (
                                        <span className="ml-1">· {box.drawerName}</span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <Badge variant={boxUsage >= 100 ? 'secondary' : 'outline'} className="mr-1">
                                      {boxUsage}%
                                    </Badge>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      title="Print box QR label"
                                      onClick={() => openBoxQr(box, archiveRecords[cabinet._id!])}
                                    >
                                      <QrCode className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                            {(archiveRecords[cabinet._id!].physicalBoxes || []).length === 0 && (
                              <p className="text-xs text-muted-foreground p-2">
                                No physical boxes generated yet. Use &quot;Move Students to Boxes&quot; above.
                              </p>
                            )}
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">Loading archive details…</p>
                      )}
                    </div>
                  ) : (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold">Drawers</h4>
                      <Badge variant="outline">{cabinet.drawers.length}</Badge>
                    </div>
                    <div className="space-y-2">
                      {cabinet.drawers.map((drawer, index) => {
                        const drawerUsage = drawer.capacity > 0
                          ? Math.round((drawer.currentCount / drawer.capacity) * 100)
                          : 0;
                        return (
                          <div key={index} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded">
                            <div className="flex-1">
                              <div className="font-medium">{drawer.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {drawer.currentCount}/{drawer.capacity} files
                              </div>
                            </div>
                            <Badge variant={drawerUsage >= 100 ? 'destructive' : drawerUsage >= 80 ? 'secondary' : 'outline'}>
                              {drawerUsage}%
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

        {/* Add/Edit Cabinet Dialog */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    {editingCabinet ? 'Edit Cabinet' : 'Add New Cabinet'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingCabinet
                      ? 'Update cabinet information and drawer configuration'
                      : 'Create a new cabinet with drawers and capacity settings'}
                  </DialogDescription>
                </div>
                {!editingCabinet && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSmartSuggest}
                    className="gap-2"
                    title="Fill form with smart suggestions"
                  >
                    <Sparkles className="h-4 w-4" />
                    Smart Fill
                  </Button>
                )}
              </div>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Cabinet Name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Math Cabinet"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="identifier">Identifier (Optional)</Label>
                <Input
                  id="identifier"
                  value={form.identifier}
                  onChange={(e) => setForm(prev => ({ ...prev, identifier: e.target.value }))}
                  placeholder="e.g., A, B, 1, 2, or leave blank"
                />
                <p className="text-xs text-muted-foreground">
                  Use this to distinguish between cabinets with the same name (e.g., "Math Cabinet A" vs "Math Cabinet B")
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="school">School</Label>
                {isAdmin ? (
                  <Select
                    value={form.school}
                    onValueChange={(value) => setForm(prev => ({ ...prev, school: value }))}
                    required
                  >
                    <SelectTrigger id="school">
                      <SelectValue placeholder="Select School" />
                    </SelectTrigger>
                    <SelectContent>
                      {schoolOptions.map(school => (
                        <SelectItem key={school} value={school}>{school}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex items-center gap-2 h-10 px-3 rounded-md border bg-muted/50 text-sm text-foreground select-none">
                    {form.school || userSchool || '—'}
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label>Drawers</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addDrawer}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Drawer
                  </Button>
                </div>
                <div className="space-y-3">
                  {form.drawers.map((drawer, index) => (
                    <Card key={index}>
                      <CardContent className="p-4">
                        <div className="flex gap-2 items-start">
                          <div className="flex-1 space-y-2">
                            <Label htmlFor={`drawer-name-${index}`}>Drawer Name</Label>
                            <Input
                              id={`drawer-name-${index}`}
                              value={drawer.name}
                              onChange={(e) => updateDrawer(index, 'name', e.target.value)}
                              placeholder="e.g., Drawer 1"
                              required
                            />
                          </div>
                          <div className="flex-1 space-y-2">
                            <Label htmlFor={`drawer-capacity-${index}`}>Capacity</Label>
                            <Input
                              id={`drawer-capacity-${index}`}
                              type="number"
                              value={drawer.capacity}
                              onChange={(e) => updateDrawer(index, 'capacity', parseInt(e.target.value) || 0)}
                              placeholder="0"
                              required
                              min="0"
                            />
                          </div>
                          {form.drawers.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeDrawer(index)}
                              className="mt-7"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsModalOpen(false);
                    setForm({ name: '', identifier: '', school: userSchool, drawers: [{ name: '', capacity: 0 }] });
                    setEditingCabinet(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className="gap-2">
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      {editingCabinet ? 'Update Cabinet' : 'Create Cabinet'}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Cabinet Creation Help Dialog */}
        <Dialog open={helpModalOpen} onOpenChange={setHelpModalOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-primary" />
                How to Create Cabinets
              </DialogTitle>
              <DialogDescription>
                Use cabinets to represent physical filing cabinets, rooms, shelves, or archive boxes. Drawers hold the capacity counts.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5">
              <Alert>
                <Sparkles className="h-4 w-4" />
                <AlertTitle>Fastest option</AlertTitle>
                <AlertDescription>
                  Click <strong>Add Cabinet</strong>, then use <strong>Smart Fill</strong> in the form. It suggests a cabinet name, school, identifier, five drawers, and default capacities.
                </AlertDescription>
              </Alert>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Example 1: Main Cabinet</CardTitle>
                    <CardDescription>Good for current active student files.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p><strong>Name:</strong> Main Cabinet</p>
                    <p><strong>Identifier:</strong> 0001</p>
                    <p><strong>School:</strong> School 8</p>
                    <p><strong>Drawers:</strong> Drawer A, Drawer B, Drawer C, Drawer D</p>
                    <p><strong>Capacity:</strong> 75-100 per drawer</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Example 2: Archive Cabinet</CardTitle>
                    <CardDescription>Good for graduated, inactive, or older records.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p><strong>Name:</strong> Archive Cabinet</p>
                    <p><strong>Identifier:</strong> 2025-A</p>
                    <p><strong>School:</strong> District 79</p>
                    <p><strong>Drawers:</strong> FY 2023, FY 2024, FY 2025</p>
                    <p><strong>Capacity:</strong> 200-300 per drawer</p>
                  </CardContent>
                </Card>
              </div>

              <div className="rounded-lg border p-4 space-y-3">
                <h3 className="font-semibold">Field guide</h3>
                <div className="grid gap-3 md:grid-cols-2 text-sm text-muted-foreground">
                  <div>
                    <p className="font-medium text-foreground">Cabinet Name</p>
                    <p>Use the physical label people recognize, like Main Cabinet, Storage Cabinet, or Archive Cabinet.</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Identifier</p>
                    <p>Optional but helpful when you have more than one cabinet with the same name, such as 0001, 0002, A, or B.</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">School</p>
                    <p>Assign the cabinet to the school/program that owns those files. Admins can create school options in School Configuration.</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Drawer Capacity</p>
                    <p>Enter the number of student folders that physically fit in that drawer. The app uses this for near-full and over-capacity warnings.</p>
                  </div>
                </div>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Recommended naming pattern</AlertTitle>
                <AlertDescription>
                  Keep names simple and consistent: <strong>Main Cabinet (0001)</strong>, <strong>Main Cabinet (0002)</strong>, then drawers like <strong>Drawer A</strong>, <strong>Drawer B</strong>, or fiscal-year names.
                </AlertDescription>
              </Alert>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setHelpModalOpen(false)}>
                Close
              </Button>
              <Button onClick={() => {
                setHelpModalOpen(false);
                setIsModalOpen(true);
              }}>
                Create Cabinet
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Archive Box QR Dialog */}
        <Dialog open={boxQrOpen} onOpenChange={setBoxQrOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" /> Box Label — QR + Student List
              </DialogTitle>
              <DialogDescription>
                Print and attach to the physical box. The QR opens a public page with this box location and file list — no login required.
              </DialogDescription>
            </DialogHeader>
            {selectedBox && selectedBoxArchive && (
              <div className="space-y-4">
                {boxLabelLoading ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Loading student list…
                  </div>
                ) : (
                  <ArchiveBoxLabelSheet
                    box={selectedBox}
                    archive={{
                      cabinetName: selectedBoxArchive.cabinetName,
                      cabinetIdentifier: selectedBoxArchive.cabinetIdentifier,
                      school: selectedBoxArchive.school,
                      schoolYear: selectedBoxArchive.schoolYear,
                      location: selectedBoxArchive.location,
                      archiveDate: selectedBoxArchive.archiveDate,
                    }}
                    students={boxLabelStudents}
                    origin={boxLabelOrigin}
                  />
                )}
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 gap-2"
                    disabled={boxLabelLoading}
                    onClick={() => window.print()}
                  >
                    <Printer className="h-4 w-4" /> Print Label
                  </Button>
                  <ArchiveBoxPdfButton
                    className="flex-1 gap-2"
                    disabled={boxLabelLoading}
                    box={selectedBox}
                    archive={{
                      cabinetName: selectedBoxArchive.cabinetName,
                      cabinetIdentifier: selectedBoxArchive.cabinetIdentifier,
                      school: selectedBoxArchive.school,
                      schoolYear: selectedBoxArchive.schoolYear,
                      location: selectedBoxArchive.location,
                      archiveDate: selectedBoxArchive.archiveDate,
                    }}
                    students={boxLabelStudents}
                    origin={boxLabelOrigin}
                  />
                  <Button variant="outline" className="flex-1 gap-2" asChild disabled={boxLabelLoading}>
                    <a
                      href={getBoxPublicUrl(selectedBox._id, boxLabelOrigin)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open public page
                    </a>
                  </Button>
                  <Button variant="outline" className="flex-1 gap-2" asChild disabled={boxLabelLoading}>
                    <a
                      href={`/archive/box/${selectedBox._id}/label`}
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

        {/* Archive Cabinet Dialog */}
        <Dialog open={archiveModalOpen} onOpenChange={(open) => {
          setArchiveModalOpen(open);
          if (!open) {
            setEndOfYearCloseout(false);
            setArchivingCabinet(null);
          }
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PackageOpen className="h-5 w-5 text-amber-600" />
                Archive Cabinet — End of School Year
              </DialogTitle>
              <DialogDescription>
                Record where the physical archive boxes are being stored for{' '}
                <strong>{archivingCabinet?.name}{archivingCabinet?.identifier ? ` (${archivingCabinet.identifier})` : ''}</strong>.
                Student files will be moved from drawers into archive boxes, status set to Archived,
                and each box gets a scannable QR label.
              </DialogDescription>
            </DialogHeader>

            {archivingCabinet && (
              <div className="flex items-center gap-4 rounded-lg border bg-muted/40 px-4 py-3 text-sm">
                <Building2 className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Cabinet</p>
                    <p className="font-medium">{archivingCabinet.name} {archivingCabinet.identifier ? `(${archivingCabinet.identifier})` : ''}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">School</p>
                    <p className="font-medium">{archivingCabinet.school || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Student Files</p>
                    <p className="font-medium">{archivingCabinet.currentCount} / {archivingCabinet.totalCapacity}</p>
                  </div>
                </div>
              </div>
            )}

            {archivingCabinet &&
              (archivingCabinet.currentCount || 0) < (archivingCabinet.totalCapacity || 0) && (
              <Alert className="border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-800">
                <AlertCircle className="h-4 w-4 text-amber-700" />
                <AlertTitle className="text-amber-900 dark:text-amber-200">
                  This cabinet is not full
                </AlertTitle>
                <AlertDescription className="text-amber-900/90 dark:text-amber-100/90 space-y-3">
                  <p>
                    {(archivingCabinet.totalCapacity || 0) - (archivingCabinet.currentCount || 0)} drawer
                    slot{(archivingCabinet.totalCapacity || 0) - (archivingCabinet.currentCount || 0) !== 1 ? 's' : ''}{' '}
                    are still empty. At end of school year you can still archive — files move to boxes and the cabinet closes for new assignments.
                  </p>
                  <div className="flex items-start gap-3 rounded-md border border-amber-200/80 bg-background/80 p-3 dark:border-amber-800">
                    <Switch
                      id="endOfYearCloseout"
                      checked={endOfYearCloseout}
                      onCheckedChange={(checked) => setEndOfYearCloseout(checked === true)}
                    />
                    <div className="space-y-1">
                      <Label htmlFor="endOfYearCloseout" className="font-medium cursor-pointer">
                        End-of-year closeout
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        I confirm this cabinet should be archived even though drawers are not full.
                        Empty slots will not stay available for new intake.
                      </p>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleArchiveSubmit} className="space-y-5">
              {/* School Year + Archive Date */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="schoolYear" className="flex items-center gap-1.5">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" /> School Year
                  </Label>
                  <Select
                    value={archiveForm.schoolYear}
                    onValueChange={v => setArchiveForm(f => ({ ...f, schoolYear: v }))}
                  >
                    <SelectTrigger id="schoolYear">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FISCAL_YEAR_OPTIONS.map(y => (
                        <SelectItem key={y} value={y}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="archiveDate" className="flex items-center gap-1.5">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" /> Archive Date
                  </Label>
                  <Input
                    id="archiveDate"
                    type="date"
                    value={archiveForm.archiveDate}
                    onChange={e => setArchiveForm(f => ({ ...f, archiveDate: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <Separator />

              {/* Archive Boxes */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1.5">
                    <Boxes className="h-4 w-4 text-muted-foreground" /> Archive Boxes
                  </Label>
                  <Button type="button" variant="outline" size="sm" onClick={addArchiveBox} className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> Add Box Type
                  </Button>
                </div>
                <div className="rounded-md border bg-muted/20 p-1 text-xs text-muted-foreground flex items-start gap-1.5 px-3 py-2">
                  <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  {archiveStudentCount > 0 ? (
                    <>
                      Pick a box size (50 / 100 / 200) to auto-calculate how many boxes you need for{' '}
                      <strong className="text-foreground">{archiveStudentCount.toLocaleString()} student file(s)</strong>.
                      You can still adjust the box count manually.
                    </>
                  ) : (
                    <>Add one row per box size. Use presets (50 / 100 / 200 files per box) or enter a custom size.</>
                  )}
                </div>
                <div className="space-y-3">
                  {archiveForm.boxes.map((box, i) => (
                    <div key={i} className="flex items-end gap-3 rounded-lg border p-3 bg-card">
                      <div className="space-y-1.5 flex-1">
                        <Label className="text-xs text-muted-foreground">Files per Box</Label>
                        <div className="flex gap-1.5 flex-wrap">
                          {BOX_PRESETS.map(p => (
                            <Button
                              key={p}
                              type="button"
                              size="sm"
                              variant={box.filesPerBox === p ? 'default' : 'outline'}
                              className="h-8 px-3"
                              onClick={() => setArchiveBoxPreset(i, p)}
                            >
                              {p}
                            </Button>
                          ))}
                          <Input
                            type="number"
                            min={1}
                            value={BOX_PRESETS.includes(box.filesPerBox) ? '' : box.filesPerBox}
                            placeholder="Custom"
                            className="h-8 w-24"
                            onChange={e => setArchiveBoxCustomSize(i, parseInt(e.target.value, 10) || 1)}
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5 w-32">
                        <Label className="text-xs text-muted-foreground">Number of Boxes</Label>
                        <div className="flex items-center gap-1">
                          <Button type="button" variant="outline" size="icon" className="h-8 w-8"
                            onClick={() => updateArchiveBox(i, 'quantity', Math.max(1, box.quantity - 1))}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <Input
                            type="number"
                            min={1}
                            value={box.quantity}
                            className="h-8 text-center"
                            onChange={e => updateArchiveBox(i, 'quantity', parseInt(e.target.value) || 1)}
                          />
                          <Button type="button" variant="outline" size="icon" className="h-8 w-8"
                            onClick={() => updateArchiveBox(i, 'quantity', box.quantity + 1)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground w-36 pb-1">
                        = <strong>{(box.quantity * box.filesPerBox).toLocaleString()}</strong> file slots
                        {archiveStudentCount > 0 && box.quantity * box.filesPerBox >= archiveStudentCount && (
                          <span className="block text-xs text-green-700 dark:text-green-400">Covers all files</span>
                        )}
                      </div>
                      {archiveForm.boxes.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                          onClick={() => removeArchiveBox(i)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex justify-end text-sm font-medium text-foreground">
                  Total capacity across all boxes:{' '}
                  <span className={`ml-1 ${archiveTotalFiles < (archivingCabinet?.currentCount || 0) ? 'text-destructive' : 'text-primary'}`}>
                    {archiveTotalFiles.toLocaleString()} file slots
                  </span>
                  {archivingCabinet && archiveTotalFiles < (archivingCabinet.currentCount || 0) && (
                    <span className="ml-2 text-destructive text-xs font-normal">
                      (need at least {archivingCabinet.currentCount})
                    </span>
                  )}
                </div>
              </div>

              <Separator />

              {/* Physical Location */}
              <div className="space-y-2">
                <Label htmlFor="archiveLocation" className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-muted-foreground" /> Physical Storage Location
                </Label>
                <Input
                  id="archiveLocation"
                  value={archiveForm.location}
                  onChange={e => setArchiveForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="e.g., Storage Room 201 — Shelf B, Row 3"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Describe exactly where the boxes will be stored so anyone can find them later.
                </p>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="archiveNotes">Notes (optional)</Label>
                <Textarea
                  id="archiveNotes"
                  rows={3}
                  value={archiveForm.notes}
                  onChange={e => setArchiveForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Any additional context — e.g., 'Boxes sealed and labelled. Contact John for access.'"
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setArchiveModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    archivingLoading ||
                    !archiveForm.location ||
                    archiveTotalFiles < (archivingCabinet?.currentCount || 0) ||
                    ((archivingCabinet?.currentCount || 0) < (archivingCabinet?.totalCapacity || 0) && !endOfYearCloseout)
                  }
                  className="gap-2 bg-amber-600 hover:bg-amber-700 text-white border-amber-600"
                >
                  {archivingLoading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Archiving...</>
                  ) : (
                    <><Archive className="h-4 w-4" /> Archive Cabinet</>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Audit Results Dialog */}
        <Dialog open={auditModalOpen} onOpenChange={setAuditModalOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                Audit Results
              </DialogTitle>
              <DialogDescription>
                Students with missing or invalid cabinet/drawer assignments
              </DialogDescription>
            </DialogHeader>
            {auditResults.length === 0 ? (
              <Alert className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                <AlertTitle className="text-green-800 dark:text-green-200">All Clear!</AlertTitle>
                <AlertDescription className="text-green-700 dark:text-green-300">
                  No students with missing or invalid cabinet/drawer assignments! 🎉
                </AlertDescription>
              </Alert>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student ID</TableHead>
                        <TableHead>First Name</TableHead>
                        <TableHead>Last Name</TableHead>
                        <TableHead>Cabinet</TableHead>
                        <TableHead>Drawer</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditResults.map((s, i) => (
                        <TableRow key={s._id || i}>
                          <TableCell className="font-mono text-xs">{s.studentId}</TableCell>
                          <TableCell>{s.firstName}</TableCell>
                          <TableCell>{s.lastName}</TableCell>
                          <TableCell>
                            {s.cabinet ? (
                              s.cabinet
                            ) : (
                              <Badge variant="destructive">Missing</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {s.drawer ? (
                              s.drawer
                            ) : (
                              <Badge variant="destructive">Missing</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-4">
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Found {auditResults.length} issue(s)</AlertTitle>
                    <AlertDescription>
                      Please review and fix the missing or invalid assignments above.
                    </AlertDescription>
                  </Alert>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setAuditModalOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
} 