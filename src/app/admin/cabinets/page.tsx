'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Cabinet, ArchiveBox, CabinetArchiveRecord, PhysicalArchiveBox } from '@/types/cabinet';
import DrawerRosterDialog, { type RosterStudent } from '@/components/DrawerRosterDialog';
import FixStudentAssignmentDialog from '@/components/FixStudentAssignmentDialog';
import BarcodeScanner from '@/components/BarcodeScanner';
import ArchivePackingPreview, {
  PARTIAL_ARCHIVE_STATUSES,
} from '@/components/ArchivePackingPreview';
import CabinetBoxQrDialog from '@/components/CabinetBoxQrDialog';
import CabinetStorageLabelsDialog from '@/components/CabinetStorageLabelsDialog';
import CabinetFloorMapDialog from '@/components/CabinetFloorMapDialog';
import { type BoxLabelStudent } from '@/lib/boxLabel';
import { buildCabinetStorageLabels, type StorageLabelItem } from '@/lib/cabinetLabel';
import { Checkbox } from '@/components/ui/checkbox';
import {
  clampDrawerCapacity,
  DRAWER_CAPACITY_MAX,
  DRAWER_CAPACITY_MIN,
  DRAWER_CAPACITY_PRESETS,
  getDrawerSectionBreakdown,
  getDrawerSectionSize,
  isDrawerCapacityPreset,
  SECTIONS_PER_DRAWER,
} from '@/lib/drawerSections';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Building2, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Archive,
  Boxes,
  ArrowDownUp,
  HelpCircle,
  PackageOpen,
  MapPin,
  CalendarDays,
  Minus,
  Info,
  QrCode,
  History,
  Tag,
  Users,
  Scan,
  Download,
  Lock,
  LayoutGrid,
} from 'lucide-react';
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
import PageIntro from '@/components/PageIntro';
import { fiscalYearOptions } from '@/lib/studentOptions';

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
  type CabinetFormDrawer = {
    _id?: string;
    name: string;
    capacity: number;
    locked?: boolean;
    /** UI-only: show custom capacity number input */
    useCustomCapacity?: boolean;
  };

  const [form, setForm] = useState<{
    name: string;
    identifier: string;
    school: string;
    mapRow: string;
    mapCol: string;
    drawers: CabinetFormDrawer[];
  }>({
    name: '',
    identifier: '',
    school: '',
    mapRow: '',
    mapCol: '',
    drawers: [{ name: '', capacity: 400, locked: false, useCustomCapacity: false }],
  });
  const [rosterOpen, setRosterOpen] = useState(false);
  const [rosterTarget, setRosterTarget] = useState<{
    cabinetId: string;
    cabinetName: string;
    drawerId?: string;
    drawerName?: string;
    section?: string;
  } | null>(null);
  const [fixStudent, setFixStudent] = useState<{
    studentIds: string[];
    label?: string;
  } | null>(null);
  const [locateHighlight, setLocateHighlight] = useState<{
    cabinetId: string;
    drawerId?: string;
    section?: string;
    studentName?: string;
    labelId?: string;
  } | null>(null);
  const [locateError, setLocateError] = useState('');
  const [floorMapOpen, setFloorMapOpen] = useState(false);
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
  const FISCAL_YEAR_OPTIONS = fiscalYearOptions();
  const BOX_PRESETS = [50, 100, 200];
  const [archiveForm, setArchiveForm] = useState<{
    schoolYear: string;
    boxes: ArchiveBox[];
    location: string;
    archiveDate: string;
    notes: string;
    statuses: string[];
    drawerIds: string[];
    manualAssignments: Record<string, string>;
    archiveCabinet: boolean;
  }>({
    schoolYear: FISCAL_YEAR_OPTIONS[0],
    boxes: [{ quantity: 1, filesPerBox: 100 }],
    location: '',
    archiveDate: new Date().toISOString().split('T')[0],
    notes: '',
    statuses: [],
    drawerIds: [],
    manualAssignments: {},
    archiveCabinet: true,
  });
  const [archiveStep, setArchiveStep] = useState<'setup' | 'preview'>('setup');
  const [partialArchiveMode, setPartialArchiveMode] = useState(false);
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
  const [storageLabelsOpen, setStorageLabelsOpen] = useState(false);
  const [storageLabels, setStorageLabels] = useState<StorageLabelItem[]>([]);
  const [storageLabelsTitle, setStorageLabelsTitle] = useState('');
  const [labelFilter, setLabelFilter] = useState<'all' | 'cabinet' | 'drawer' | 'section'>('all');
  const [moveHistoryOpen, setMoveHistoryOpen] = useState(false);
  const [moveHistory, setMoveHistory] = useState<any[]>([]);
  const [moveHistoryLoading, setMoveHistoryLoading] = useState(false);

  function openStorageLabels(cabinet: Cabinet) {
    setStorageLabels(buildCabinetStorageLabels(cabinet));
    setStorageLabelsTitle(
      cabinet.identifier ? `${cabinet.name} (${cabinet.identifier})` : cabinet.name,
    );
    setLabelFilter('all');
    setStorageLabelsOpen(true);
  }

  async function openMoveHistory() {
    setMoveHistoryOpen(true);
    setMoveHistoryLoading(true);
    try {
      const res = await fetch('/api/cabinets/move-history?limit=50');
      const data = await res.json();
      setMoveHistory(Array.isArray(data) ? data : []);
    } catch {
      setMoveHistory([]);
    } finally {
      setMoveHistoryLoading(false);
    }
  }

  function openArchiveModal(cabinet: Cabinet) {
    const studentCount = cabinet.currentCount || 0;
    const isPartial = studentCount < (cabinet.totalCapacity || 0);
    setArchivingCabinet(cabinet);
    setEndOfYearCloseout(!isPartial);
    setPartialArchiveMode(false);
    setArchiveStep('setup');
    setArchiveForm({
      schoolYear: FISCAL_YEAR_OPTIONS[0],
      boxes: suggestArchiveBoxes(studentCount),
      location: '',
      archiveDate: new Date().toISOString().split('T')[0],
      notes: '',
      statuses: [],
      drawerIds: [],
      manualAssignments: {},
      archiveCabinet: true,
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
  const isPartialArchive =
    partialArchiveMode ||
    archiveForm.statuses.length > 0 ||
    archiveForm.drawerIds.length > 0 ||
    !archiveForm.archiveCabinet;

  async function handleArchiveSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!archivingCabinet) return;

    if (archiveStep === 'setup') {
      if (!archiveForm.location.trim()) {
        setError('Enter a physical storage location for the archive boxes.');
        return;
      }
      const cabinetNotFull =
        (archivingCabinet.currentCount || 0) < (archivingCabinet.totalCapacity || 0);
      if (!isPartialArchive && cabinetNotFull && !endOfYearCloseout) {
        setError('Turn on end-of-year closeout to archive a cabinet that is not full.');
        return;
      }
      if (!isPartialArchive && archiveTotalFiles < (archivingCabinet.currentCount || 0)) {
        setError(
          `Add enough archive boxes for all ${archivingCabinet.currentCount} student file(s). Current box layout holds ${archiveTotalFiles}.`,
        );
        return;
      }
      setError('');
      setArchiveStep('preview');
      return;
    }

    setArchivingLoading(true);
    try {
      const payload = {
        schoolYear: archiveForm.schoolYear,
        boxes: archiveForm.boxes,
        location: archiveForm.location,
        archiveDate: archiveForm.archiveDate,
        notes: archiveForm.notes,
        statuses: archiveForm.statuses.length ? archiveForm.statuses : undefined,
        drawerIds: archiveForm.drawerIds.length ? archiveForm.drawerIds : undefined,
        manualAssignments:
          Object.keys(archiveForm.manualAssignments).length > 0
            ? archiveForm.manualAssignments
            : undefined,
        archiveCabinet: isPartialArchive ? false : archiveForm.archiveCabinet,
      };
      const res = await fetch(`/api/cabinets/${archivingCabinet._id}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to archive cabinet');
        return;
      }
      setArchiveModalOpen(false);
      setArchivingCabinet(null);
      setEndOfYearCloseout(false);
      setPartialArchiveMode(false);
      setArchiveStep('setup');
      await fetchCabinets();
      const modeLabel = data.partial ? 'Partial archive' : 'Cabinet archived';
      setSyncMessage(
        `${modeLabel} for "${archivingCabinet.name}" (${archiveForm.schoolYear}). ` +
        `${data.boxCount ?? archiveForm.boxes.length} box(es), ${data.studentsAssigned ?? 0} student file(s) → ${archiveForm.location}.`
      );
      if (syncTimeout.current) clearTimeout(syncTimeout.current);
      syncTimeout.current = setTimeout(() => setSyncMessage(''), 8000);
    } catch {
      setError('Failed to archive cabinet');
    } finally {
      setArchivingLoading(false);
    }
  }

  async function handleLocateScan(scannedId: string) {
    setLocateError('');
    try {
      const res = await fetch(
        `/api/students/lookup?studentId=${encodeURIComponent(scannedId)}`,
      );
      const data = await res.json();
      if (!res.ok) {
        setLocateError(data.error || 'Student not found');
        setLocateHighlight(null);
        return;
      }
      const cabinetId = data.cabinet ? String(data.cabinet) : '';
      if (!cabinetId) {
        setLocateError(
          data.archiveBoxLabel
            ? `${data.firstName || ''} ${data.lastName || ''} is in archive box ${data.archiveBoxLabel}.`
            : 'Student has no active cabinet assignment.',
        );
        setLocateHighlight(null);
        return;
      }
      setLocateHighlight({
        cabinetId,
        drawerId: data.drawer ? String(data.drawer) : undefined,
        section: data.drawerSection || undefined,
        studentName: [data.lastName, data.firstName].filter(Boolean).join(', '),
        labelId: data.labelId || data.studentId || scannedId,
      });
      const el = document.getElementById(`cabinet-card-${cabinetId}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch {
      setLocateError('Lookup failed');
      setLocateHighlight(null);
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

  const emptyCabinetForm = (school = userSchool) => ({
    name: '',
    identifier: '',
    school,
    mapRow: '',
    mapCol: '',
    drawers: [{ name: '', capacity: 400, locked: false, useCustomCapacity: false }],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      for (const drawer of form.drawers) {
        const cap = Number(drawer.capacity);
        if (!Number.isFinite(cap) || cap < DRAWER_CAPACITY_MIN || cap > DRAWER_CAPACITY_MAX) {
          throw new Error(
            `Each drawer capacity must be between ${DRAWER_CAPACITY_MIN} and ${DRAWER_CAPACITY_MAX} files.`,
          );
        }
      }

      const drawers = form.drawers.map(({ useCustomCapacity: _ui, ...drawer }) => ({
        ...drawer,
        capacity: clampDrawerCapacity(drawer.capacity),
      }));
      const totalCapacity = drawers.reduce((sum, drawer) => sum + drawer.capacity, 0);
      const parseMap = (v: string) => {
        if (v.trim() === '') return null;
        const n = parseInt(v, 10);
        return Number.isFinite(n) ? n : null;
      };
      const payload = {
        name: form.name,
        identifier: form.identifier,
        school: form.school,
        drawers,
        totalCapacity,
        currentCount: 0,
        mapRow: parseMap(form.mapRow),
        mapCol: parseMap(form.mapCol),
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
      setForm(emptyCabinetForm());
      setEditingCabinet(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save cabinet');
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
      drawers: [...prev.drawers, { name: '', capacity: 400, locked: false, useCustomCapacity: false }],
    }));
  };

  const removeDrawer = (index: number) => {
    setForm(prev => ({
      ...prev,
      drawers: prev.drawers.filter((_, i) => i !== index)
    }));
  };

  const updateDrawer = (
    index: number,
    field: 'name' | 'capacity' | 'locked' | 'useCustomCapacity',
    value: string | number | boolean,
  ) => {
    setForm(prev => ({
      ...prev,
      drawers: prev.drawers.map((drawer, i) =>
        i === index ? { ...drawer, [field]: value } : drawer
      )
    }));
  };

  function openRoster(opts: {
    cabinet: Cabinet;
    drawer?: Cabinet['drawers'][number];
    section?: string;
  }) {
    const cabinetName = opts.cabinet.identifier
      ? `${opts.cabinet.name} (${opts.cabinet.identifier})`
      : opts.cabinet.name;
    setRosterTarget({
      cabinetId: opts.cabinet._id!,
      cabinetName,
      drawerId: opts.drawer?._id,
      drawerName: opts.drawer?.name,
      section: opts.section,
    });
    setRosterOpen(true);
  }

  const peakWarnings = cabinets.filter(
    (c) =>
      (c.status ?? 'Active') !== 'Archived' && c.fillForecast?.warnBeforePeak,
  );

  function formatWeeksLeft(forecast: Cabinet['fillForecast']) {
    if (!forecast) return null;
    if (forecast.weeksLeft == null) {
      return forecast.available > 0 ? 'n/a (no recent fill)' : 'Full';
    }
    if (forecast.weeksLeft > 52) return '52+ weeks left';
    if (forecast.weeksLeft === 0) return '<1 week left';
    return `~${forecast.weeksLeft} week${forecast.weeksLeft === 1 ? '' : 's'} left`;
  }

  const handleSmartSuggest = () => {
    if (editingCabinet) return; // Don't suggest when editing
    
    const commonNames = ['Main Cabinet', 'Storage Cabinet', 'Archive Cabinet', 'Records Cabinet', 'Files Cabinet'];
    const drawerNames = ['Drawer A', 'Drawer B', 'Drawer C', 'Drawer D', 'Drawer E'];
    const defaultCapacity = 400;
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
      capacity: defaultCapacity,
      locked: false,
      useCustomCapacity: !isDrawerCapacityPreset(defaultCapacity),
    }));
    
    setForm({
      name: suggestedName,
      identifier: suggestedIdentifier,
      school: suggestedSchool,
      mapRow: '',
      mapCol: '',
      drawers: suggestedDrawers,
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
      <div className="w-full space-y-6">
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
    <div className="w-full space-y-6">
      <PageIntro
        eyebrow="Storage"
        title="Cabinet Management"
        description="Manage cabinets, drawers, and storage assignments."
        icon={<LayoutGrid className="h-5 w-5 text-primary" />}
        actions={
          <>
            <Button variant="outline" onClick={() => setHelpModalOpen(true)} className="gap-2">
              <HelpCircle className="h-4 w-4" />
              How to Create
            </Button>
            <Button
              onClick={() => {
                setEditingCabinet(null);
                setForm(emptyCabinetForm(userSchool));
                setIsModalOpen(true);
              }}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Cabinet
            </Button>
          </>
        }
      />

      {/* Overview — compact strip (no metric card farm) */}
      <div className="flex flex-wrap gap-x-8 gap-y-3 rounded-lg border border-border bg-muted/30 px-4 py-3 ui-enter ui-enter-delay-1">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Cabinets</p>
          <p className="text-xl font-semibold tabular-nums tracking-tight">{cabinets.length}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Stored files</p>
          <p className="text-xl font-semibold tabular-nums tracking-tight">{cabinetStats.currentCount}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Available</p>
          <p className={`text-xl font-semibold tabular-nums tracking-tight ${availableCapacity < 0 ? 'text-destructive' : ''}`}>
            {availableCapacity}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Needs attention</p>
          <p className={`text-xl font-semibold tabular-nums tracking-tight ${cabinetStats.overCapacity > 0 ? 'text-destructive' : ''}`}>
            {cabinetStats.needsAttention + cabinetStats.overCapacity}
          </p>
        </div>
      </div>

      {peakWarnings.length > 0 && (
        <Alert className="border-amber-300 bg-amber-50/70 dark:bg-amber-950/20 dark:border-amber-800">
          <AlertCircle className="h-4 w-4 text-amber-700" />
          <AlertTitle className="text-amber-900 dark:text-amber-200">
            Capacity may run out before peak intake
          </AlertTitle>
          <AlertDescription className="text-amber-900/90 dark:text-amber-100/90 space-y-1">
            <p>
              At the current fill rate, {peakWarnings.length} cabinet
              {peakWarnings.length === 1 ? '' : 's'} would fill before the next
              typical peak ({peakWarnings[0].fillForecast?.peakLabel || 'peak'}
              {peakWarnings[0].fillForecast?.weeksUntilPeak != null
                ? ` · ~${peakWarnings[0].fillForecast.weeksUntilPeak} weeks away`
                : ''}
              ).
            </p>
            <ul className="list-disc pl-5 text-sm">
              {peakWarnings.slice(0, 6).map((c) => (
                <li key={c._id}>
                  {c.name}
                  {c.identifier ? ` (${c.identifier})` : ''}
                  {' — '}
                  {formatWeeksLeft(c.fillForecast)} left at current rate
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

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
          <div className="flex gap-2 flex-wrap items-center">
          <BarcodeScanner onScan={handleLocateScan} onManualEntry={handleLocateScan} />
          <Button
            onClick={() => setFloorMapOpen(true)}
            variant="outline"
            className="gap-2"
          >
            <LayoutGrid className="h-4 w-4" />
            Floor Map
          </Button>
          <Button
            onClick={openMoveHistory}
            variant="outline"
            className="gap-2"
          >
            <History className="h-4 w-4" />
            Move History
          </Button>
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
        {(locateHighlight || locateError) && (
          <Alert className={locateError ? 'border-destructive/50' : 'border-primary/40 bg-primary/5'}>
            <Scan className="h-4 w-4" />
            <AlertTitle>
              {locateError ? 'Locate failed' : 'Located student'}
            </AlertTitle>
            <AlertDescription className="flex flex-wrap items-center gap-2">
              {locateError || (
                <>
                  <span>
                    {locateHighlight?.studentName || 'Student'}
                    {locateHighlight?.labelId ? ` (${locateHighlight.labelId})` : ''}
                    {locateHighlight?.section
                      ? ` · ${locateHighlight.section}`
                      : ''}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setLocateHighlight(null);
                      setLocateError('');
                    }}
                  >
                    Clear
                  </Button>
                </>
              )}
            </AlertDescription>
          </Alert>
        )}
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
                  setForm(emptyCabinetForm(userSchool));
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

            const isLocateHit = locateHighlight?.cabinetId === cabinet._id;
            return (
              <Card
                id={`cabinet-card-${cabinet._id}`}
                key={cabinet._id}
                className={`border-border/80 shadow-none ${
                  isLocateHit ? 'ring-2 ring-primary' : ''
                }`}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                        {cabinet.name}
                        {isLocateHit && (
                          <Badge className="gap-1">
                            <Scan className="h-3 w-3" /> Found
                          </Badge>
                        )}
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
                        <span className="ui-badge-warning">
                          <Archive className="h-3 w-3" /> Archived
                        </span>
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
                      {cabinet.status !== 'Archived' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Print cabinet / drawer / section labels"
                          aria-label="Print cabinet storage labels"
                          onClick={() => openStorageLabels(cabinet)}
                        >
                          <Tag className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit ${cabinet.name}`}
                        onClick={() => {
                          setEditingCabinet(cabinet);
                          setForm({
                            name: cabinet.name,
                            identifier: cabinet.identifier || '',
                            school: cabinet.school || '',
                            mapRow:
                              cabinet.mapRow != null ? String(cabinet.mapRow) : '',
                            mapCol:
                              cabinet.mapCol != null ? String(cabinet.mapCol) : '',
                            drawers: cabinet.drawers.map((d) => ({
                              _id: d._id,
                              name: d.name,
                              capacity: d.capacity,
                              locked: Boolean(d.locked),
                              useCustomCapacity: !isDrawerCapacityPreset(d.capacity),
                            })),
                          });
                          setIsModalOpen(true);
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${cabinet.name}`}
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
                    {cabinet.status !== 'Archived' && cabinet.fillForecast && (
                      <div className="space-y-1">
                        <p className="text-[11px] text-muted-foreground">
                          Fill rate: {cabinet.fillForecast.assignedInWindow} file(s) / {cabinet.fillForecast.windowDays}d
                          {' · '}
                          <span className="font-medium text-foreground">
                            {formatWeeksLeft(cabinet.fillForecast)}
                          </span>
                        </p>
                        {cabinet.fillForecast.warnBeforePeak && (
                          <p className="text-[11px] text-amber-800 dark:text-amber-300 font-medium">
                            May fill before {cabinet.fillForecast.peakLabel || 'peak intake'}
                          </p>
                        )}
                      </div>
                    )}
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
                                      aria-label="Print box QR label"
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
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          title="View all students in this cabinet"
                          onClick={() => openRoster({ cabinet })}
                        >
                          <Users className="h-3.5 w-3.5" />
                          Roster
                        </Button>
                        <Badge variant="outline">{cabinet.drawers.length}</Badge>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {cabinet.drawers.map((drawer, index) => {
                        const drawerUsage = drawer.capacity > 0
                          ? Math.round((drawer.currentCount / drawer.capacity) * 100)
                          : 0;
                        const sections = getDrawerSectionBreakdown(
                          drawer.currentCount || 0,
                          drawer.capacity || 0,
                        );
                        const sectionSize = getDrawerSectionSize(drawer.capacity || 0);
                        const drawerLocate =
                          isLocateHit &&
                          locateHighlight?.drawerId &&
                          locateHighlight.drawerId === drawer._id;
                        return (
                          <div
                            key={drawer._id || index}
                            className={`text-sm p-2 rounded space-y-2 ${
                              drawerLocate
                                ? 'bg-primary/10 ring-1 ring-primary'
                                : drawer.locked
                                  ? 'bg-muted/80 opacity-80'
                                  : 'bg-muted/50'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <button
                                type="button"
                                className="flex-1 min-w-0 text-left hover:underline"
                                title="View drawer roster"
                                onClick={() => openRoster({ cabinet, drawer })}
                              >
                                <div className="font-medium flex items-center gap-1.5">
                                  {drawer.name}
                                  {drawer.locked && (
                                    <Badge variant="outline" className="gap-1 text-[10px] h-5">
                                      <Lock className="h-3 w-3" /> Do not fill
                                    </Badge>
                                  )}
                                  {drawerLocate && (
                                    <Badge className="text-[10px] h-5">Here</Badge>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {drawer.currentCount}/{drawer.capacity} files
                                  {' · '}
                                  {SECTIONS_PER_DRAWER} sections × ~{sectionSize}
                                </div>
                              </button>
                              <Badge variant={drawerUsage >= 100 ? 'destructive' : drawerUsage >= 80 ? 'secondary' : 'outline'}>
                                {drawerUsage}%
                              </Badge>
                            </div>
                            <div className="grid grid-cols-4 gap-1">
                              {sections.map((section) => {
                                const sectionHit =
                                  drawerLocate &&
                                  locateHighlight?.section === section.label;
                                return (
                                <button
                                  key={section.label}
                                  type="button"
                                  onClick={() =>
                                    openRoster({
                                      cabinet,
                                      drawer,
                                      section: section.label,
                                    })
                                  }
                                  className={
                                    sectionHit
                                      ? 'rounded border border-primary bg-primary/15 px-1 py-0.5 text-[10px] text-foreground text-left ring-1 ring-primary'
                                      : section.status === 'full'
                                      ? 'rounded border border-emerald-300 bg-emerald-50 px-1 py-0.5 text-[10px] text-emerald-900 text-left hover:ring-1 hover:ring-emerald-400'
                                      : section.status === 'partial'
                                        ? 'rounded border border-amber-300 bg-amber-50 px-1 py-0.5 text-[10px] text-amber-900 text-left hover:ring-1 hover:ring-amber-400'
                                        : 'rounded border border-border/60 bg-background/80 px-1 py-0.5 text-[10px] text-muted-foreground text-left hover:ring-1 hover:ring-border'
                                  }
                                  title={`${section.label}: ${section.filled}/${section.capacity} — click to view students`}
                                >
                                  <div className="font-medium leading-tight">{section.label.replace('Section ', 'S')}</div>
                                  <div className="tabular-nums leading-tight">{section.filled}/{section.capacity}</div>
                                </button>
                                );
                              })}
                            </div>
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

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="mapRow">Floor map row (optional)</Label>
                  <Input
                    id="mapRow"
                    type="number"
                    min={0}
                    value={form.mapRow}
                    onChange={(e) => setForm((prev) => ({ ...prev, mapRow: e.target.value }))}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mapCol">Floor map column (optional)</Label>
                  <Input
                    id="mapCol"
                    type="number"
                    min={0}
                    value={form.mapCol}
                    onChange={(e) => setForm((prev) => ({ ...prev, mapCol: e.target.value }))}
                    placeholder="0"
                  />
                </div>
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
                            <Select
                              value={
                                drawer.useCustomCapacity || !isDrawerCapacityPreset(drawer.capacity)
                                  ? 'custom'
                                  : String(drawer.capacity || 400)
                              }
                              onValueChange={(value) => {
                                if (value === 'custom') {
                                  setForm((prev) => ({
                                    ...prev,
                                    drawers: prev.drawers.map((d, i) =>
                                      i === index
                                        ? {
                                            ...d,
                                            useCustomCapacity: true,
                                            capacity: isDrawerCapacityPreset(d.capacity)
                                              ? d.capacity
                                              : clampDrawerCapacity(d.capacity || 400),
                                          }
                                        : d,
                                    ),
                                  }));
                                  return;
                                }
                                setForm((prev) => ({
                                  ...prev,
                                  drawers: prev.drawers.map((d, i) =>
                                    i === index
                                      ? {
                                          ...d,
                                          useCustomCapacity: false,
                                          capacity: parseInt(value, 10),
                                        }
                                      : d,
                                  ),
                                }));
                              }}
                            >
                              <SelectTrigger id={`drawer-capacity-${index}`}>
                                <SelectValue placeholder="Capacity" />
                              </SelectTrigger>
                              <SelectContent>
                                {DRAWER_CAPACITY_PRESETS.map((cap) => (
                                  <SelectItem key={cap} value={String(cap)}>
                                    {cap} files ({SECTIONS_PER_DRAWER} × {getDrawerSectionSize(cap)})
                                  </SelectItem>
                                ))}
                                <SelectItem value="custom">
                                  Custom…
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            {(drawer.useCustomCapacity || !isDrawerCapacityPreset(drawer.capacity)) && (
                              <div className="space-y-1">
                                <Input
                                  id={`drawer-capacity-custom-${index}`}
                                  type="number"
                                  min={DRAWER_CAPACITY_MIN}
                                  max={DRAWER_CAPACITY_MAX}
                                  step={1}
                                  value={drawer.capacity || ''}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    if (raw === '') {
                                      updateDrawer(index, 'capacity', 0);
                                      return;
                                    }
                                    const n = parseInt(raw, 10);
                                    if (!Number.isFinite(n)) return;
                                    updateDrawer(index, 'capacity', n);
                                  }}
                                  placeholder={`e.g. 250 (${DRAWER_CAPACITY_MIN}–${DRAWER_CAPACITY_MAX})`}
                                  required
                                />
                                <p className="text-[11px] text-muted-foreground">
                                  Custom capacity: {DRAWER_CAPACITY_MIN}–{DRAWER_CAPACITY_MAX} files.
                                  {drawer.capacity > 0
                                    ? ` → ${SECTIONS_PER_DRAWER} sections × ~${getDrawerSectionSize(drawer.capacity)}`
                                    : ''}
                                </p>
                              </div>
                            )}
                            {!(drawer.useCustomCapacity || !isDrawerCapacityPreset(drawer.capacity)) && (
                              <p className="text-[11px] text-muted-foreground">
                                Auto sections: Section 01–{String(SECTIONS_PER_DRAWER).padStart(2, '0')} (hidden from intake)
                              </p>
                            )}
                          </div>
                          {form.drawers.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={`Remove drawer ${drawer.name || index + 1}`}
                              onClick={() => removeDrawer(index)}
                              className="mt-7"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                        <div className="mt-3 flex items-center gap-2 rounded-md border px-3 py-2">
                          <Switch
                            id={`drawer-locked-${index}`}
                            checked={Boolean(drawer.locked)}
                            onCheckedChange={(checked) =>
                              updateDrawer(index, 'locked', checked === true)
                            }
                          />
                          <div>
                            <Label htmlFor={`drawer-locked-${index}`} className="cursor-pointer flex items-center gap-1.5">
                              <Lock className="h-3.5 w-3.5" /> Do not fill (locked)
                            </Label>
                            <p className="text-[11px] text-muted-foreground">
                              Skipped by Smart Fill / next open slot. Existing files stay.
                            </p>
                          </div>
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
                    setForm(emptyCabinetForm());
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
                    <p>Choose drawer capacity 100, 200, 400, or Custom (1–5000 files). Cabinet total capacity is the sum of its drawers. Each drawer is split into 8 automatic sections (Section 01–08) for filing — assigned when a student is stored, and not shown on intake.</p>
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

        <CabinetBoxQrDialog
          open={boxQrOpen}
          onOpenChange={setBoxQrOpen}
          box={selectedBox}
          archive={selectedBoxArchive}
          students={boxLabelStudents}
          loading={boxLabelLoading}
          origin={boxLabelOrigin}
        />

        {/* Archive Cabinet Dialog */}
        <Dialog open={archiveModalOpen} onOpenChange={(open) => {
          setArchiveModalOpen(open);
          if (!open) {
            setEndOfYearCloseout(false);
            setPartialArchiveMode(false);
            setArchiveStep('setup');
            setArchivingCabinet(null);
          }
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PackageOpen className="h-5 w-5 text-amber-600" />
                {archiveStep === 'preview' ? 'Preview box packing' : 'Archive Cabinet'}
                {partialArchiveMode ? ' — Partial' : ' — End of School Year'}
              </DialogTitle>
              <DialogDescription>
                {archiveStep === 'preview' ? (
                  <>Review who goes in which box. Override any student before commit.</>
                ) : (
                  <>
                    Record where physical archive boxes will be stored for{' '}
                    <strong>{archivingCabinet?.name}{archivingCabinet?.identifier ? ` (${archivingCabinet.identifier})` : ''}</strong>.
                    {partialArchiveMode
                      ? ' Only selected statuses/drawers move to boxes; the cabinet stays Active.'
                      : ' Student files move into archive boxes, status set to Archived, and each box gets a scannable QR label.'}
                  </>
                )}
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

            <form onSubmit={handleArchiveSubmit} className="space-y-5">
              {archiveStep === 'setup' && (
                <>
                  <div className="flex items-start gap-3 rounded-md border p-3">
                    <Switch
                      id="partialArchiveMode"
                      checked={partialArchiveMode}
                      onCheckedChange={(checked) => {
                        const on = checked === true;
                        setPartialArchiveMode(on);
                        setArchiveForm((f) => ({
                          ...f,
                          archiveCabinet: !on,
                          statuses: on ? [...PARTIAL_ARCHIVE_STATUSES] : [],
                          drawerIds: on ? f.drawerIds : [],
                          manualAssignments: {},
                        }));
                      }}
                    />
                    <div className="space-y-1">
                      <Label htmlFor="partialArchiveMode" className="font-medium cursor-pointer">
                        Partial archive (leave actives in drawers)
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Archive only Graduated / Transferred / etc. Cabinet stays open for intake.
                      </p>
                    </div>
                  </div>

                  {partialArchiveMode && archivingCabinet && (
                    <div className="space-y-3 rounded-md border p-3">
                      <Label>Statuses to archive</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {PARTIAL_ARCHIVE_STATUSES.map((status) => (
                          <label key={status} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={archiveForm.statuses.includes(status)}
                              onCheckedChange={(checked) => {
                                setArchiveForm((f) => ({
                                  ...f,
                                  statuses: checked
                                    ? [...f.statuses, status]
                                    : f.statuses.filter((s) => s !== status),
                                  manualAssignments: {},
                                }));
                              }}
                            />
                            {status}
                          </label>
                        ))}
                      </div>
                      <Label className="pt-2">Drawers (optional — empty = all)</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {archivingCabinet.drawers.map((d) => (
                          <label key={d._id} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={archiveForm.drawerIds.includes(d._id)}
                              onCheckedChange={(checked) => {
                                setArchiveForm((f) => ({
                                  ...f,
                                  drawerIds: checked
                                    ? [...f.drawerIds, d._id]
                                    : f.drawerIds.filter((id) => id !== d._id),
                                  manualAssignments: {},
                                }));
                              }}
                            />
                            {d.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {!partialArchiveMode &&
                    archivingCabinet &&
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
                          are still empty.
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
                              Archive the whole cabinet even though drawers are not full.
                            </p>
                          </div>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="schoolYear" className="flex items-center gap-1.5">
                        <CalendarDays className="h-4 w-4 text-muted-foreground" /> School Year
                      </Label>
                      <Select
                        value={archiveForm.schoolYear}
                        onValueChange={v => setArchiveForm(f => ({ ...f, schoolYear: v, manualAssignments: {} }))}
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
                          Pick a box size for about{' '}
                          <strong className="text-foreground">{archiveStudentCount.toLocaleString()} file(s)</strong>
                          {partialArchiveMode ? ' in this cabinet (filter applied on preview).' : '.'}
                        </>
                      ) : (
                        <>Add one row per box size.</>
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
                                aria-label="Decrease box quantity"
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
                                aria-label="Increase box quantity"
                                onClick={() => updateArchiveBox(i, 'quantity', box.quantity + 1)}>
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <div className="text-sm text-muted-foreground w-36 pb-1">
                            = <strong>{(box.quantity * box.filesPerBox).toLocaleString()}</strong> file slots
                          </div>
                          {archiveForm.boxes.length > 1 && (
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                              aria-label="Remove box size"
                              onClick={() => removeArchiveBox(i)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-end text-sm font-medium text-foreground">
                      Total capacity:{' '}
                      <span className="ml-1 text-primary">{archiveTotalFiles.toLocaleString()} file slots</span>
                    </div>
                  </div>

                  <Separator />

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
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="archiveNotes">Notes (optional)</Label>
                    <Textarea
                      id="archiveNotes"
                      rows={3}
                      value={archiveForm.notes}
                      onChange={e => setArchiveForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="Any additional context"
                    />
                  </div>
                </>
              )}

              {archiveStep === 'preview' && archivingCabinet && (
                <ArchivePackingPreview
                  cabinetId={archivingCabinet._id!}
                  schoolYear={archiveForm.schoolYear}
                  boxes={archiveForm.boxes}
                  statuses={archiveForm.statuses}
                  drawerIds={archiveForm.drawerIds}
                  manualAssignments={archiveForm.manualAssignments}
                  onManualChange={(next) =>
                    setArchiveForm((f) => ({ ...f, manualAssignments: next }))
                  }
                />
              )}

              <DialogFooter className="gap-2 sm:gap-0">
                {archiveStep === 'preview' ? (
                  <Button type="button" variant="outline" onClick={() => setArchiveStep('setup')}>
                    Back
                  </Button>
                ) : (
                  <Button type="button" variant="outline" onClick={() => setArchiveModalOpen(false)}>
                    Cancel
                  </Button>
                )}
                <Button
                  type="submit"
                  disabled={
                    archivingLoading ||
                    !archiveForm.location ||
                    (archiveStep === 'setup' &&
                      !isPartialArchive &&
                      (archivingCabinet?.currentCount || 0) < (archivingCabinet?.totalCapacity || 0) &&
                      !endOfYearCloseout) ||
                    (archiveStep === 'setup' &&
                      partialArchiveMode &&
                      archiveForm.statuses.length === 0)
                  }
                  className="gap-2 bg-amber-600 hover:bg-amber-700 text-white border-amber-600"
                >
                  {archivingLoading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Archiving...</>
                  ) : archiveStep === 'setup' ? (
                    <><Archive className="h-4 w-4" /> Preview packing</>
                  ) : (
                    <><Archive className="h-4 w-4" /> {partialArchiveMode ? 'Commit partial archive' : 'Archive Cabinet'}</>
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
                  No students with missing or invalid cabinet or drawer assignments.
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

        <CabinetStorageLabelsDialog
          open={storageLabelsOpen}
          onOpenChange={setStorageLabelsOpen}
          title={storageLabelsTitle}
          labels={storageLabels}
          filter={labelFilter}
          onFilterChange={setLabelFilter}
        />

        {rosterTarget && (
          <DrawerRosterDialog
            open={rosterOpen}
            onOpenChange={setRosterOpen}
            cabinetId={rosterTarget.cabinetId}
            cabinetName={rosterTarget.cabinetName}
            drawerId={rosterTarget.drawerId}
            drawerName={rosterTarget.drawerName}
            section={rosterTarget.section}
            onReassign={(student: RosterStudent) => {
              setFixStudent({
                studentIds: [student._id],
                label: student.name,
              });
            }}
            onSectionChanged={(message) => {
              setSyncMessage(message);
              if (syncTimeout.current) clearTimeout(syncTimeout.current);
              syncTimeout.current = setTimeout(() => setSyncMessage(''), 6000);
            }}
          />
        )}

        {fixStudent && (
          <FixStudentAssignmentDialog
            open={Boolean(fixStudent)}
            onOpenChange={(open) => {
              if (!open) setFixStudent(null);
            }}
            studentIds={fixStudent.studentIds}
            studentLabel={fixStudent.label}
            source="cabinets-roster"
            onDone={(message) => {
              setFixStudent(null);
              setSyncMessage(message);
              if (syncTimeout.current) clearTimeout(syncTimeout.current);
              syncTimeout.current = setTimeout(() => setSyncMessage(''), 8000);
              fetchCabinets();
              if (rosterOpen) {
                setRosterOpen(false);
                setTimeout(() => setRosterOpen(true), 0);
              }
            }}
          />
        )}

        <CabinetFloorMapDialog
          open={floorMapOpen}
          onOpenChange={setFloorMapOpen}
          cabinets={cabinets}
          highlightCabinetId={locateHighlight?.cabinetId}
          onUpdated={() => { void fetchCabinets(); }}
          onSelectCabinet={(cab) => {
            setFloorMapOpen(false);
            document
              .getElementById(`cabinet-card-${cab._id}`)
              ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setLocateHighlight({
              cabinetId: cab._id!,
              studentName: cab.name,
            });
          }}
        />

        <Dialog open={moveHistoryOpen} onOpenChange={setMoveHistoryOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <DialogTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" /> Move History
                  </DialogTitle>
                  <DialogDescription>
                    Who moved which student files, from → to. Also appears in Audit Logs.
                  </DialogDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 shrink-0"
                  onClick={() =>
                    window.open('/api/cabinets/move-history?format=csv&limit=500', '_blank')
                  }
                >
                  <Download className="h-4 w-4" /> CSV
                </Button>
              </div>
            </DialogHeader>
            {moveHistoryLoading ? (
              <div className="flex items-center gap-2 py-8 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : moveHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No moves recorded yet. Bulk Move and Fix Assignment will appear here.
              </p>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Students</TableHead>
                      <TableHead>Sample move</TableHead>
                      <TableHead>By</TableHead>
                      <TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {moveHistory.map((ev) => {
                      const first = ev.students?.[0];
                      const fromLabel = first?.from
                        ? [first.from.cabinetName, first.from.drawerName, first.from.drawerSection]
                            .filter(Boolean)
                            .join(' / ') || '—'
                        : '—';
                      const toLabel = first?.to
                        ? [first.to.cabinetName, first.to.drawerName, first.to.drawerSection]
                            .filter(Boolean)
                            .join(' / ') || '—'
                        : '—';
                      return (
                        <TableRow key={ev._id}>
                          <TableCell className="text-sm whitespace-nowrap">
                            {ev.createdAt ? new Date(ev.createdAt).toLocaleString() : '—'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {ev.studentCount || ev.students?.length || 0}
                            {first?.name ? (
                              <div className="text-xs text-muted-foreground truncate max-w-[10rem]">
                                e.g. {first.name}
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-sm">
                            <span className="text-muted-foreground">{fromLabel}</span>
                            {' → '}
                            <span className="font-medium">{toLabel}</span>
                          </TableCell>
                          <TableCell className="text-sm">
                            {ev.user?.name || ev.user?.email || '—'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {ev.source || '—'}
                            {ev.note ? (
                              <div className="truncate max-w-[8rem]" title={ev.note}>{ev.note}</div>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setMoveHistoryOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
} 