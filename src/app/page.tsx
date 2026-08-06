"use client";
import React, { Suspense, useEffect, useRef, useState } from "react";
import { FileDown, FileUp, Printer, Trash2, Edit, Eye, Moon, Sun, RotateCcw, List, Archive, X, Upload, History, Filter, TrendingUp, Package } from 'lucide-react';
import { useSession } from 'next-auth/react';
import StudentTable, { Student } from "../components/StudentTable";
import DashboardStats from '@/components/DashboardStats';
import PrintHistory from '@/components/PrintHistory';
import ReprintButton from '@/components/ReprintButton';
import SavedSearches from '@/components/SavedSearches';
import BarcodeScanner from '@/components/BarcodeScanner';
import EditStudentModal from '@/components/EditStudentModal';
import DeleteConfirmationModal from '@/components/DeleteConfirmationModal';
import BulkUpdateModal from '@/components/BulkUpdateModal';
import AuditLogModal from '@/components/AuditLogModal';
import PrinterConfig from '@/components/PrinterConfig';
import DashboardHeader from '@/components/DashboardHeader';
import StudentFilters from '@/components/StudentFilters';
import StudentActionsBar from '@/components/StudentActionsBar';
import StudentEmptyState from '@/components/StudentEmptyState';
import IntakePrintQueue from '@/components/IntakePrintQueue';
import SelectionPrintTray from '@/components/SelectionPrintTray';
import PrintView from '@/components/PrintView';
import UndoSnackbar from '@/components/UndoSnackbar';
import StudentDetailsDialog from '@/components/StudentDetailsDialog';
import { Cabinet } from '../types/cabinet';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { extractStudentIdFromQrPayload } from '@/lib/qrPayload';
import { downloadCsvFile, objectsToCsv } from '@/lib/csv';
import { getStoredPrintLayout, setStoredPrintLayout } from '@/lib/printLayoutStorage';
import { formatFullName, formatFullNameLower } from '@/lib/personName';

const FISCAL_YEAR_OPTIONS = [
  '2024-2025', '2025-2026', '2026-2027', '2027-2028'
];
const STATUS_OPTIONS = [
  'Active', 'Inactive', 'Graduated', 'Withdrawn', 'Pending', 'Transferred', 'Other'
];

const LABEL_TEMPLATES = [
  { key: 'avery5160', name: 'Avery 5160 (3x10 Sheet)', cols: 3, rows: 10, width: 2.625, height: 1 },
  { key: 'avery5163', name: 'Avery 5163 (2x5 Sheet)', cols: 2, rows: 5, width: 4, height: 2 },
  { key: 'avery94205', name: 'Avery 94205 (2x5 — 1.5"×3.75")', cols: 2, rows: 5, width: 3.75, height: 1.5 },
  // Brother QL-800 Compatible Labels (Continuous Feed)
  { key: 'brother1201', name: 'Brother DK-1201 (1.1" x 3.5")', cols: 1, rows: 1, width: 3.5, height: 1.1, printer: 'QL-800', continuous: true },
  { key: 'brother11208', name: 'Brother DK-11208 (1.1" x 2.1")', cols: 1, rows: 1, width: 2.1, height: 1.1, printer: 'QL-800', continuous: true },
  { key: 'brother2205', name: 'Brother DK-2205 (2.1" x 2.1")', cols: 1, rows: 1, width: 2.1, height: 2.1, printer: 'QL-800', continuous: true },
  { key: 'brother22208', name: 'Brother DK-22208 (2.1" x 2.8")', cols: 1, rows: 1, width: 2.8, height: 2.1, printer: 'QL-800', continuous: true },
];

export default function DashboardPage() {
  return (
    <Suspense fallback={<main className="p-6 text-sm text-muted-foreground">Loading dashboard…</main>}>
      <Dashboard />
    </Suspense>
  );
}

function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const userRole = (session?.user as any)?.role;
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [search, setSearch] = useState("");
  const [filterYear, setFilterYear] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [printMode, setPrintMode] = useState(false);
  const [detailsStudent, setDetailsStudent] = useState<Student | null>(null);
  const [undoData, setUndoData] = useState<{ students: Student[], timer: NodeJS.Timeout | null }>({ students: [], timer: null });
  const [showUndo, setShowUndo] = useState(false);
  const [auditLog, setAuditLog] = useState<{ action: string, student: Student | Student[], time: string, user?: { name: string, email: string, role: string, school: string } | null }[]>([]);
  const [showAudit, setShowAudit] = useState(false);
  const [showBulkUpdate, setShowBulkUpdate] = useState(false);
  const [bulkUpdate, setBulkUpdate] = useState({ status: '', fiscalYear: '' });
  const [showArchived, setShowArchived] = useState(false);
  const [printLayout, setPrintLayoutState] = useState('avery5163');
  const [cabinets, setCabinets] = useState<Cabinet[]>([]);
  const [showPrintHistory, setShowPrintHistory] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [showQRCode, setShowQRCode] = useState(true);
  const [showPrinterConfig, setShowPrinterConfig] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [needsLabelMode, setNeedsLabelMode] = useState(false);
  const [printedIds, setPrintedIds] = useState<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [advancedFilters, setAdvancedFilters] = useState({
    startDate: '',
    endDate: '',
    cabinet: 'all',
    drawer: 'all',
    email: ''
  });

  // Fetch students
  useEffect(() => {
    if (status !== 'authenticated') return;
    if (session?.user?.forcePasswordChange) {
      router.push('/profile');
      return;
    }
    // Intake Members only have access to the intake form
    if ((session?.user as any)?.role === 'Intake Member') {
      router.push('/intake');
      return;
    }
    fetchStudents();
    fetchCabinets();
    fetchPrintedIds();
  }, [status, session, router]);

  // Deep-link from command palette: /?q=labelId
  useEffect(() => {
    const q = searchParams?.get('q');
    if (q) setSearch(q);
  }, [searchParams]);

  // Remember last-used Avery/Brother layout
  useEffect(() => {
    setPrintLayoutState(getStoredPrintLayout('avery5163'));
  }, []);

  function setPrintLayout(layout: string) {
    setPrintLayoutState(layout);
    setStoredPrintLayout(layout);
  }

  async function fetchPrintedIds() {
    try {
      const res = await fetch('/api/print-history?limit=200');
      if (!res.ok) return;
      const logs = await res.json();
      const ids = new Set<string>();
      if (Array.isArray(logs)) {
        for (const log of logs) {
          for (const s of log.students || []) {
            if (s.studentId) ids.add(s.studentId);
            if (s.labelId) ids.add(s.labelId);
          }
        }
      }
      setPrintedIds(ids);
    } catch (err) {
      console.error('Failed to fetch print history for intake queue:', err);
    }
  }

  async function fetchStudents() {
    setLoading(true);
    setError("");
    try {
      if (status !== 'authenticated') return;
      const res = await fetch("/api/students");
      const data = await res.json();
      setStudents(data);
    } catch (err) {
      setError("Failed to fetch students");
    } finally {
      setLoading(false);
    }
  }

  async function fetchCabinets() {
    try {
      if (status !== 'authenticated') return;
      const res = await fetch('/api/cabinets');
      const data = await res.json();
      setCabinets(data);
    } catch (err) {
      console.error('Error fetching cabinets:', err);
    }
  }

  // Build cabinet and drawer maps
  const cabinetMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    cabinets.forEach(cab => { 
      map[cab._id] = getCabinetDisplayName(cab);
    });
    return map;
  }, [cabinets]);
  const drawerMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    cabinets.forEach(cab => cab.drawers.forEach(drawer => { map[drawer._id] = drawer.name; }));
    return map;
  }, [cabinets]);
  // Fetch audit logs from API
  async function fetchAuditLogs() {
    if (status !== 'authenticated') return;
    const res = await fetch('/api/audit-logs');
    const data = await res.json();
    setAuditLog(data);
  }

  // Fetch audit logs when modal opens
  useEffect(() => {
    if (showAudit && status === 'authenticated') fetchAuditLogs();
  }, [showAudit, status]);

  // POST audit log to API
  async function logAudit(action: string, student: Student | Student[]) {
    const userInfo = session?.user ? {
      name: session.user.name || 'Unknown',
      email: session.user.email || 'Unknown',
      role: (session.user as any)?.role || 'Unknown',
      school: (session.user as any)?.school || 'Unknown'
    } : null;
    
    const log = { 
      action, 
      student, 
      time: new Date().toLocaleString(),
      user: userInfo
    };
    setAuditLog((prev) => [log, ...prev]);
    await fetch('/api/audit-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(log),
    });
  }

  function openEditModal(student: Student) {
    setEditStudent(student);
    setEditModalOpen(true);
  }

  function closeEditModal() {
    setEditModalOpen(false);
    setEditStudent(null);
  }

  async function handleEditSave(formData: any) {
    if (!editStudent?._id) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const payload: Student = {
        ...formData,
        studentId: editStudent.studentId,
        endDate: editStudent.endDate || null,
        archived: editStudent.archived || false
      };
      const res = await fetch(`/api/students/${editStudent._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to update student");
      setSuccess("Student updated successfully!");
      logAudit('Edit', payload);
      closeEditModal();
      fetchStudents();
    } catch (err) {
      setError("Failed to update student");
    } finally {
      setLoading(false);
    }
  }

  // Download CSV template
  function handleDownloadTemplate() {
    downloadCsvFile(
      'student_import_template.csv',
      objectsToCsv([], ['firstName', 'lastName', 'dob', 'fiscalYear', 'status', 'startDate', 'email', 'studentId'])
    );
  }

  // CSV Export
  function handleExportCsv() {
    downloadCsvFile('students.csv', objectsToCsv(students.map(({ _id, ...rest }) => rest)));
  }

  // Get unique fiscal years and statuses for dropdowns
  const fiscalYears = Array.from(new Set(students.map(s => s.fiscalYear).filter(Boolean)));
  const statuses = Array.from(new Set(students.map(s => s.status).filter(Boolean)));

  // Filtered students
  const filteredStudents = students.filter(student => {
    if (!showArchived && student.archived) return false;
    const normalizedSearch = extractStudentIdFromQrPayload(search).toLowerCase().trim();
    const dobDigits = (student.dob || '').replace(/[^0-9]/g, '');
    const searchDigits = normalizedSearch.replace(/[^0-9]/g, '');
    const matchesSearch = normalizedSearch ? (
      (student.firstName?.toLowerCase() || '').includes(normalizedSearch) ||
      (student.lastName?.toLowerCase() || '').includes(normalizedSearch) ||
      formatFullNameLower(student).includes(normalizedSearch) ||
      (student.studentId?.toLowerCase() || '').includes(normalizedSearch) ||
      (student.labelId?.toLowerCase() || '').includes(normalizedSearch) ||
      (student.dob?.toLowerCase() || '').includes(normalizedSearch) ||
      (searchDigits.length >= 4 && dobDigits.includes(searchDigits))
    ) : true;
    const matchesYear = filterYear && filterYear !== 'all' ? student.fiscalYear === filterYear : true;
    const matchesStatus = filterStatus && filterStatus !== 'all' ? student.status === filterStatus : true;

    // Needs label: created in last 7 days and not in recent print history
    let matchesNeedsLabel = true;
    if (needsLabelMode) {
      const created = student.createdAt ? Date.parse(student.createdAt) : NaN;
      const recent = !Number.isNaN(created) && (Date.now() - created) <= 7 * 24 * 60 * 60 * 1000;
      const keys = [student.labelId, student.studentId].filter(Boolean) as string[];
      const alreadyPrinted = keys.some(k => printedIds.has(k));
      matchesNeedsLabel = recent && !alreadyPrinted && !student.archived;
    }
    
    // Advanced filters
    const matchesStartDate = advancedFilters.startDate ? 
      student.startDate >= advancedFilters.startDate : true;
    const matchesEndDate = advancedFilters.endDate ? 
      student.startDate <= advancedFilters.endDate : true;
    const matchesCabinet = advancedFilters.cabinet && advancedFilters.cabinet !== 'all' ? 
      student.cabinet === advancedFilters.cabinet : true;
    const matchesDrawer = advancedFilters.drawer && advancedFilters.drawer !== 'all' ? 
      student.drawer === advancedFilters.drawer : true;
    const matchesEmail = advancedFilters.email ? 
      (student.email?.toLowerCase() || '').includes(advancedFilters.email.toLowerCase()) : true;
    
    return matchesSearch && matchesYear && matchesStatus && matchesNeedsLabel &&
           matchesStartDate && matchesEndDate && matchesCabinet && 
           matchesDrawer && matchesEmail;
  });

  const hasActiveFilters = Boolean(
    search ||
    (filterYear && filterYear !== 'all') ||
    (filterStatus && filterStatus !== 'all') ||
    needsLabelMode ||
    advancedFilters.startDate ||
    advancedFilters.endDate ||
    (advancedFilters.cabinet && advancedFilters.cabinet !== 'all') ||
    (advancedFilters.drawer && advancedFilters.drawer !== 'all') ||
    advancedFilters.email
  );

  function clearAllFilters() {
    setSearch('');
    setFilterYear('all');
    setFilterStatus('all');
    setNeedsLabelMode(false);
    setAdvancedFilters({
      startDate: '',
      endDate: '',
      cabinet: 'all',
      drawer: 'all',
      email: '',
    });
  }

  // Pagination logic
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const pageCount = Math.ceil(filteredStudents.length / pageSize);
  const paginatedStudents = filteredStudents.slice((page - 1) * pageSize, page * pageSize);

  // Handle selection
  function toggleSelect(id: string) {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter(_id => _id !== id) : [...prev, id]);
  }
  // Select / deselect only the CURRENT PAGE (not all filtered records)
  function selectAll() {
    const pageIds = paginatedStudents.map(s => s._id!);
    const allPageSelected = pageIds.length > 0 && pageIds.every(id => selectedIds.includes(id));
    if (allPageSelected) {
      // Deselect this page but keep any other pages' selections
      setSelectedIds(prev => prev.filter(id => !pageIds.includes(id)));
    } else {
      // Add this page to the selection (union, no duplicates)
      setSelectedIds(prev => [...new Set([...prev, ...pageIds])]);
    }
  }
  // Header checkbox reflects current PAGE state, not all filtered
  const allPageSelected = paginatedStudents.length > 0 && paginatedStudents.every(s => selectedIds.includes(s._id!));
  const somePageSelected = paginatedStudents.some(s => selectedIds.includes(s._id!)) && !allPageSelected;
  const selectedStudents = filteredStudents.filter(s => selectedIds.includes(s._id!));

  // Print history + stock decrement happen when the user downloads Word or prints
  // (see PrintView / Avery DOCX routes) — not when the preview merely opens.

  // Reset to page 1 when filters/search change
  useEffect(() => { setPage(1); }, [search, filterYear, filterStatus, pageSize]);

  // Undo delete
  function handleUndoDelete() {
    if (undoData.students.length === 0) return;
    undoData.students.forEach(async (student) => {
      const payload: Student = {
        firstName: student.firstName,
        lastName: student.lastName,
        dob: student.dob,
        fiscalYear: student.fiscalYear,
        status: student.status,
        startDate: student.startDate,
        cabinet: student.cabinet,
        drawer: student.drawer,
        studentId: student.studentId,
        endDate: student.endDate,
        email: student.email,
        archived: student.archived
      };
      await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    });
    setUndoData({ students: [], timer: null });
    setShowUndo(false);
    fetchStudents();
  }

  // Update delete handlers to support undo and audit log
  async function handleDelete(id: string) {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const student = students.find(s => s._id === id);
      const res = await fetch(`/api/students/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete student");
      setSuccess("Student deleted successfully!");
      setDeleteId(null);
      setUndoData((prev) => {
        if (student) return { students: [{
          firstName: student.firstName,
          lastName: student.lastName,
          dob: student.dob,
          fiscalYear: student.fiscalYear,
          status: student.status,
          startDate: student.startDate,
          cabinet: student.cabinet,
          drawer: student.drawer,
          studentId: student.studentId,
          endDate: student.endDate || null,
          email: student.email || null,
          archived: student.archived || false
        }], timer: prev.timer };
        return prev;
      });
      setShowUndo(true);
      if (undoData.timer) clearTimeout(undoData.timer);
      const timer = setTimeout(() => {
        setShowUndo(false);
        setUndoData({ students: [], timer: null });
      }, 7000);
      setUndoData((prev) => ({ ...prev, timer }));
      logAudit('Delete', {
        _id: student?._id,
        firstName: student?.firstName || '',
        lastName: student?.lastName || '',
        dob: student?.dob || '',
        fiscalYear: student?.fiscalYear || '',
        status: student?.status || '',
        startDate: student?.startDate || '',
        cabinet: student?.cabinet || '',
        drawer: student?.drawer || '',
        studentId: student?.studentId || '',
        endDate: student?.endDate || null,
        email: student?.email || null,
        archived: student?.archived || false
      });
      fetchStudents();
    } catch (err) {
      setError("Failed to delete student");
    } finally {
      setLoading(false);
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.length === 0) return;
    if (!window.confirm('Are you sure you want to delete the selected students?')) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const deletedStudents = students.filter(s => selectedIds.includes(s._id!));
      await Promise.all(selectedIds.map(id => fetch(`/api/students/${id}`, { method: 'DELETE' })));
      setSuccess('Selected students deleted successfully!');
      setSelectedIds([]);
      const studentsToUndo: Student[] = deletedStudents.map(student => ({
        firstName: student.firstName,
        lastName: student.lastName,
        dob: student.dob,
        fiscalYear: student.fiscalYear,
        status: student.status,
        startDate: student.startDate,
        cabinet: student.cabinet,
        drawer: student.drawer,
        studentId: student.studentId,
        endDate: student.endDate || null,
        email: student.email || null,
        archived: student.archived || false
      }));
      setUndoData((prev) => ({
        students: studentsToUndo,
        timer: prev.timer
      }));
      setShowUndo(true);
      if (undoData.timer) clearTimeout(undoData.timer);
      const timer = setTimeout(() => {
        setShowUndo(false);
        setUndoData({ students: [], timer: null });
      }, 7000);
      setUndoData((prev) => ({ ...prev, timer }));
      logAudit('Bulk Delete', deletedStudents);
      fetchStudents();
    } catch (err) {
      setError('Failed to delete selected students');
    } finally {
      setLoading(false);
    }
  }

  // Export only selected students
  function handleExportSelected() {
    downloadCsvFile('selected_students.csv', objectsToCsv(selectedStudents.map(({ _id, ...rest }) => rest)));
  }

  // Bulk Update
  async function handleBulkUpdate(data: { status?: string; fiscalYear?: string }) {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await Promise.all(selectedIds.map(id => fetch(`/api/students/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(data.status && { status: data.status }),
          ...(data.fiscalYear && { fiscalYear: data.fiscalYear })
        }),
      })));
      setSuccess('Selected students updated successfully!');
      logAudit('Bulk Update', selectedStudents.map(s => ({ ...s, ...data })));
      setShowBulkUpdate(false);
      fetchStudents();
    } catch (err) {
      setError('Failed to update selected students');
    } finally {
      setLoading(false);
    }
  }

  // Helper function to find or create an available drawer in archive cabinet
  async function findOrCreateAvailableArchiveDrawer(archiveCabinetId: string): Promise<string> {
    // Fetch the latest cabinet state from the database
    const cabinetRes = await fetch(`/api/cabinets/${archiveCabinetId}`);
    if (!cabinetRes.ok) {
      throw new Error('Failed to fetch archive cabinet');
    }
    const archiveCabinet = await cabinetRes.json();

    // Find a drawer with available space
    const availableDrawer = archiveCabinet.drawers.find((drawer: any) => {
      const currentCount = drawer.currentCount || 0;
      const capacity = drawer.capacity || 0;
      return currentCount < capacity;
    });

    if (availableDrawer) {
      return availableDrawer._id;
    }

    // No available drawer found, create a new one
    const drawerNumber = archiveCabinet.drawers.length + 1;
    const newDrawer = {
      name: `Archive Drawer ${drawerNumber}`,
      capacity: 1000,
      currentCount: 0
    };

    // Update the cabinet with the new drawer, preserving currentCount for existing drawers
    const updatedDrawers = [
      ...archiveCabinet.drawers.map((d: any) => ({
        name: d.name,
        capacity: d.capacity,
        currentCount: d.currentCount || 0
      })),
      newDrawer
    ];
    const newTotalCapacity = updatedDrawers.reduce((sum: number, d: any) => sum + (d.capacity || 0), 0);

    const updateRes = await fetch(`/api/cabinets/${archiveCabinetId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: archiveCabinet.name,
        identifier: archiveCabinet.identifier || null,
        school: archiveCabinet.school,
        drawers: updatedDrawers,
        totalCapacity: newTotalCapacity
      }),
    });

    if (!updateRes.ok) {
      throw new Error('Failed to create new archive drawer');
    }

    const updatedCabinet = await updateRes.json();
    
    // Return the ID of the newly created drawer
    const createdDrawer = updatedCabinet.drawers.find((d: any) => d.name === newDrawer.name);
    if (!createdDrawer) {
      throw new Error('Failed to find newly created drawer');
    }
    return createdDrawer._id;
  }

  // Bulk Archive
  async function handleBulkArchive() {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      // First, create or get the archive cabinet
      let archiveCabinet: Cabinet | null = null;
      
      // Check if archive cabinet already exists
      const existingArchiveCabinet = cabinets.find(cab => 
        cab.name.toLowerCase().includes('archive') && (!cab.identifier || cab.identifier.toLowerCase().includes('main'))
      );
      
      if (existingArchiveCabinet) {
        archiveCabinet = existingArchiveCabinet;
      } else {
        // Create new archive cabinet
        const archiveCabinetData = {
          name: "Archive Cabinet",
          drawers: [
            {
              name: "Archive Drawer 1",
              capacity: 1000, // Large capacity for archived records
              currentCount: 0
            }
          ],
          totalCapacity: 1000,
          school: session?.user?.school || 'School 1'
        };
        
        const cabinetRes = await fetch('/api/cabinets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(archiveCabinetData)
        });
        
        if (!cabinetRes.ok) {
          throw new Error('Failed to create archive cabinet');
        }
        
        const newArchiveCabinet = await cabinetRes.json();
        archiveCabinet = newArchiveCabinet;
        
        // Refresh cabinets list
        await fetchCabinets();
      }
      
      if (!archiveCabinet || !archiveCabinet._id) {
        throw new Error('Failed to get archive cabinet');
      }

      // Archive each student and move them to archive cabinet
      // We'll find/create an available drawer for each student as needed
      const archivePromises = selectedIds.map(async (id) => {
        const student = students.find(s => s._id === id);
        if (!student) {
          console.error('Student not found in local state:', id);
          return;
        }

        // Get or create an available drawer
        let archiveDrawerId: string;
        try {
          archiveDrawerId = await findOrCreateAvailableArchiveDrawer(archiveCabinet!._id);
        } catch (error: any) {
          throw new Error(`Failed to find/create archive drawer: ${error.message}`);
        }
        
        // Update student to archived status and move to archive cabinet
        const updateRes = await fetch(`/api/students/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            archived: true,
            cabinet: archiveCabinet!._id,
            drawer: archiveDrawerId,
            status: 'Archived'
          }),
        });
        
        if (!updateRes.ok) {
          const errorText = await updateRes.text();
          console.error('Update failed for student:', id, 'Error:', errorText);
          
          // If drawer is full, try to get a new drawer and retry once
          try {
            const errorData = JSON.parse(errorText);
            if (errorData.error === 'New drawer is at full capacity') {
              // Get a new drawer and retry
              archiveDrawerId = await findOrCreateAvailableArchiveDrawer(archiveCabinet!._id);
              
              const retryRes = await fetch(`/api/students/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  archived: true,
                  cabinet: archiveCabinet!._id,
                  drawer: archiveDrawerId,
                  status: 'Archived'
                }),
              });
              
              if (!retryRes.ok) {
                const retryErrorText = await retryRes.text();
                throw new Error(`Failed to archive student ${formatFullName(student)} after retry: ${retryErrorText}`);
              }
              return; // Success on retry
            }
          } catch (parseError) {
            // If we can't parse the error, just throw the original error
          }
          
          throw new Error(`Failed to archive student ${formatFullName(student)}: ${errorText}`);
        }
      });
      
      await Promise.all(archivePromises);
      
      setSuccess(`Selected students archived and moved to Archive Cabinet!`);
      logAudit('Bulk Archive', selectedStudents);
      setSelectedIds([]);
      fetchStudents();
      fetchCabinets(); // Refresh cabinet counts
    } catch (err) {
      setError(`Failed to archive selected students: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }

  // Helper function to get cabinet display name
  function getCabinetDisplayName(cabinet: Cabinet): string {
    return cabinet.identifier ? `${cabinet.name} (${cabinet.identifier})` : cabinet.name;
  }

  // Validation helpers
  function validateEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  return (
    <div suppressHydrationWarning>
      <main className="w-full space-y-6">
        <DashboardHeader
          schoolName={session?.user?.school}
          onShowPrinterConfig={() => setShowPrinterConfig(!showPrinterConfig)}
          onShowPrintHistory={() => setShowPrintHistory(true)}
          onDownloadTemplate={handleDownloadTemplate}
        />

        <IntakePrintQueue
          students={students}
          printedIds={printedIds}
          onSelectForPrint={(ids) => {
            setSelectedIds(ids);
            setShowPrintPreview(true);
            setPrintMode(true);
          }}
        />

        {/* Printer Configuration */}
        {showPrinterConfig && (
          <section className="mb-8">
            <PrinterConfig />
          </section>
        )}

        <section>
          <StudentFilters
            search={search}
            onSearchChange={setSearch}
            filterYear={filterYear}
            onFilterYearChange={setFilterYear}
            filterStatus={filterStatus}
            onFilterStatusChange={setFilterStatus}
            showAdvancedFilters={showAdvancedFilters}
            onToggleAdvancedFilters={() => setShowAdvancedFilters(!showAdvancedFilters)}
            advancedFilters={advancedFilters}
            onAdvancedFiltersChange={setAdvancedFilters}
            fiscalYears={fiscalYears}
            statuses={statuses}
            cabinets={cabinets}
            drawers={cabinets.flatMap(cab => cab.drawers || [])}
            needsLabelMode={needsLabelMode}
            onNeedsLabelModeChange={setNeedsLabelMode}
            searchInputRef={searchInputRef}
            onLoadSearch={(filters) => {
              setSearch(filters.search || '');
              setFilterYear(filters.filterYear || 'all');
              setFilterStatus(filters.filterStatus || 'all');
              setAdvancedFilters({
                startDate: filters.startDate || '',
                endDate: filters.endDate || '',
                cabinet: filters.cabinet || 'all',
                drawer: filters.drawer || 'all',
                email: filters.email || ''
              });
            }}
          />
          <StudentActionsBar
            selectedCount={selectedIds.length}
            filteredCount={filteredStudents.length}
            userRole={userRole}
            printLayout={printLayout}
            onExportCsv={handleExportCsv}
            onExportSelected={handleExportSelected}
            onBulkUpdate={() => setShowBulkUpdate(true)}
            onBulkArchive={handleBulkArchive}
            onBulkDelete={handleBulkDelete}
            onPrintSelected={() => {
              setShowPrintPreview(true);
              setPrintMode(true);
            }}
            onPrintAllFiltered={() => {
              const allFilteredIds = filteredStudents.map(s => s._id!);
              setSelectedIds(allFilteredIds);
              setShowPrintPreview(true);
              setPrintMode(true);
            }}
            onReprint={(studentIds) => {
              const studentsToReprint = students.filter(s => s.studentId && studentIds.includes(s.studentId));
              const idsToSelect = studentsToReprint.map(s => s._id!);
              setSelectedIds(idsToSelect);
              setShowPrintPreview(true);
              setPrintMode(true);
            }}
            onReprintLast={() => {
              fetch('/api/print-history?limit=1')
                .then(res => res.json())
                .then(data => {
                  if (data.length > 0) {
                    const lastPrint = data[0];
                    const studentIds = lastPrint.students?.map((s: any) => s.studentId) || [];
                    const studentsToReprint = students.filter(s => s.studentId && studentIds.includes(s.studentId));
                    const idsToSelect = studentsToReprint.map(s => s._id!);
                    setSelectedIds(idsToSelect);
                    setShowPrintPreview(true);
                    setPrintMode(true);
                  }
                })
                .catch(err => console.error('Failed to fetch last print:', err));
            }}
            onToggleQRCode={() => setShowQRCode(!showQRCode)}
            showQRCode={showQRCode}
          />
          <div className="flex gap-2 mb-4 items-center">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />
              Show Archived
            </label>
          </div>
          {filteredStudents.length === 0 && !loading ? (
            <StudentEmptyState
              userRole={userRole}
              hasActiveFilters={hasActiveFilters}
              onClearFilters={clearAllFilters}
              onFocusSearch={() => searchInputRef.current?.focus()}
            />
          ) : (
            <StudentTable
              students={paginatedStudents}
              selectedIds={selectedIds}
              onSelect={toggleSelect}
              onSelectAll={selectAll}
              allSelected={allPageSelected}
              someSelected={somePageSelected}
              onEdit={openEditModal}
              onDelete={handleDelete}
              onDetails={setDetailsStudent}
              userRole={userRole}
              cabinetMap={cabinetMap}
              drawerMap={drawerMap}
            />
          )}
          
          {/* Pagination Controls */}
          {filteredStudents.length > 0 && (
            <div className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-700">Show:</label>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1); // Reset to first page when changing page size
                    }}
                    className="border rounded px-2 py-1 text-sm focus:outline-blue-400 focus:ring-2"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={filteredStudents.length}>All ({filteredStudents.length})</option>
                  </select>
                  <span className="text-sm text-muted-foreground">per page</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, filteredStudents.length)} of {filteredStudents.length} students
                </div>
              </div>
              
              {pageCount > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(1)}
                    disabled={page === 1}
                    className="px-3 py-1 text-sm border border-border rounded-md bg-background hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    First
                  </button>
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                    className="px-3 py-1 text-sm border border-border rounded-md bg-background hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  
                  {/* Page Numbers */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, pageCount) }, (_, i) => {
                      let pageNum;
                      if (pageCount <= 5) {
                        pageNum = i + 1;
                      } else if (page <= 3) {
                        pageNum = i + 1;
                      } else if (page >= pageCount - 2) {
                        pageNum = pageCount - 4 + i;
                      } else {
                        pageNum = page - 2 + i;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPage(pageNum)}
                          className={`px-3 py-1 text-sm border rounded-md ${
                            page === pageNum
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'border-border bg-background hover:bg-muted'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page === pageCount}
                    className="px-3 py-1 text-sm border border-border rounded-md bg-background hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                  <button
                    onClick={() => setPage(pageCount)}
                    disabled={page === pageCount}
                    className="px-3 py-1 text-sm border border-border rounded-md bg-background hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Last
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        <DashboardStats defaultCollapsed />

        {/* Edit Modal */}
        <EditStudentModal
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
          student={editStudent}
          cabinets={cabinets}
          onSave={handleEditSave}
          getCabinetDisplayName={getCabinetDisplayName}
        />

        {/* Delete Confirmation */}
        <DeleteConfirmationModal
          open={!!deleteId}
          onOpenChange={(open) => !open && setDeleteId(null)}
          onConfirm={() => {
            if (deleteId) {
              handleDelete(deleteId);
              setDeleteId(null);
            }
          }}
          studentName={deleteId ? (() => {
            const s = students.find(s => s._id === deleteId);
            return s ? formatFullName(s) : undefined;
          })() : undefined}
        />

        {/* Undo Delete Snackbar */}
        {showUndo && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-yellow-200 dark:bg-yellow-700 text-yellow-900 dark:text-yellow-100 px-6 py-3 rounded shadow-lg flex items-center gap-4 z-50 animate-bounce-in">
            <span>Student(s) deleted.</span>
            <button onClick={handleUndoDelete} className="flex items-center gap-1 px-3 py-1 bg-yellow-400 hover:bg-yellow-500 rounded font-semibold"><RotateCcw size={16} /> Undo</button>
          </div>
        )}

        {/* Audit Log Modal */}
        <AuditLogModal
          open={showAudit}
          onOpenChange={setShowAudit}
          auditLog={auditLog}
        />

        {/* Sticky print tray while selecting (stays visible while scrolling) */}
        <SelectionPrintTray
          selectedCount={selectedIds.length}
          minCount={1}
          hidden={printMode}
          sheetHint={(() => {
            const labelsPerSheet =
              printLayout === 'avery5160' ? 30 :
              printLayout === 'avery5163' || printLayout === 'avery94205' ? 10 : 0;
            if (!labelsPerSheet || selectedIds.length === 0) return null;
            const remainder = selectedIds.length % labelsPerSheet;
            if (remainder === 0) {
              const sheets = selectedIds.length / labelsPerSheet;
              return { ok: true, msg: `${sheets} full sheet${sheets !== 1 ? 's' : ''}` };
            }
            return {
              ok: false,
              msg: `Add ${labelsPerSheet - remainder} more to fill the last sheet`,
            };
          })()}
          onClear={() => setSelectedIds([])}
          onPrint={() => {
            setShowPrintPreview(true);
            setPrintMode(true);
          }}
        />

        {/* Print View */}
        {printMode && selectedStudents.length > 0 && (
          <PrintView
            students={selectedStudents}
            printLayout={printLayout}
            onPrintLayoutChange={setPrintLayout}
            showQRCode={showQRCode}
            cabinetMap={cabinetMap}
            drawerMap={drawerMap}
            onClose={() => setPrintMode(false)}
          />
        )}

        <StudentDetailsDialog
          student={detailsStudent}
          open={!!detailsStudent}
          onOpenChange={(open) => !open && setDetailsStudent(null)}
          cabinetMap={cabinetMap}
          drawerMap={drawerMap}
          showQRCode={showQRCode}
          onEdit={(student) => {
            setDetailsStudent(null);
            openEditModal(student);
          }}
        />

        {/* Bulk Update Modal */}
        <BulkUpdateModal
          open={showBulkUpdate}
          onOpenChange={setShowBulkUpdate}
          onUpdate={handleBulkUpdate}
          selectedCount={selectedIds.length}
        />
        
        {/* Print History Modal */}
        <PrintHistory 
          open={showPrintHistory} 
          onOpenChange={setShowPrintHistory}
          onReprint={(studentIds) => {
            const studentsToReprint = students.filter(s => s.studentId && studentIds.includes(s.studentId));
            const idsToSelect = studentsToReprint.map(s => s._id!);
            setSelectedIds(idsToSelect);
            setShowPrintHistory(false);
            setShowPrintPreview(true);
            setPrintMode(true);
          }}
        />
      </main>
      <style jsx global>{`
        @media print {
          body, html {
            margin: 0 !important;
            padding: 0 !important;
            box-sizing: border-box !important;
          }
          
          /* Standard sheet-based labels (Avery, etc.) */
          @page {
            size: 8.5in 11in;
            margin: 0;
          }
          
          /* Brother QL-800 Continuous Feed Labels */
          @page brother-label {
            size: auto;
            margin: 0;
          }
          
          /* Optimize for Brother QL-800 (300 DPI) */
          .brother-label {
            page: brother-label;
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
            page-break-after: always;
            page-break-inside: avoid;
          }
          
          /* Hide non-printable elements */
          .print\\:hidden {
            display: none !important;
          }
          
          /* Ensure barcodes print clearly at 300 DPI */
          svg {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          
          /* Optimize text rendering for labels */
          * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
}
