"use client";
import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { 
  ArrowLeft, 
  Download, 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  FileText,
  Building2,
  Users,
  HelpCircle,
  Pencil,
  Trash2,
  MapPin,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { parseCsvToObjects } from '@/lib/csv';
import { generateStudentId, generateLabelId, resolveAgencyId } from '@/lib/studentId';
import {
  validateStudentAddress,
  normalizeStudentAddress,
} from '@/lib/addressValidation';

const SAMPLE_DATA = [
  { firstName: 'Amelia', lastName: 'Rivera', dob: '2006-01-12', fiscalYear: '2025-2026', status: 'Active', startDate: '2025-09-04', email: 'amelia.rivera.test@example.com', studentId: '2006-AR-9000001' },
  { firstName: 'Mateo', lastName: 'Santiago', dob: '2005-03-22', fiscalYear: '2025-2026', status: 'Active', startDate: '2025-09-04', email: 'mateo.santiago.test@example.com', studentId: '2005-MS-9000002' },
  { firstName: 'Sophia', lastName: 'Chen', dob: '2004-07-18', fiscalYear: '2025-2026', status: 'Active', startDate: '2025-09-04', email: 'sophia.chen.test@example.com', studentId: '2004-SC-9000003' },
  { firstName: 'Elijah', lastName: 'Patel', dob: '2006-11-03', fiscalYear: '2025-2026', status: 'Pending', startDate: '2025-09-10', email: 'elijah.patel.test@example.com', studentId: '2006-EP-9000004' },
  { firstName: 'Mia', lastName: 'Johnson', dob: '2005-05-30', fiscalYear: '2025-2026', status: 'Active', startDate: '2025-09-12', email: 'mia.johnson.test@example.com', studentId: '2005-MJ-9000005' },
  { firstName: 'Noah', lastName: 'Williams', dob: '2004-12-09', fiscalYear: '2025-2026', status: 'Transferred', startDate: '2025-08-28', email: 'noah.williams.test@example.com', studentId: '2004-NW-9000006' },
  { firstName: 'Isabella', lastName: 'Garcia', dob: '2006-02-14', fiscalYear: '2025-2026', status: 'Active', startDate: '2025-09-04', email: 'isabella.garcia.test@example.com', studentId: '2006-IG-9000007' },
  { firstName: 'Lucas', lastName: 'Brown', dob: '2005-09-25', fiscalYear: '2025-2026', status: 'Inactive', startDate: '2025-09-04', email: 'lucas.brown.test@example.com', studentId: '2005-LB-9000008' },
  { firstName: 'Ava', lastName: 'Martinez', dob: '2004-10-06', fiscalYear: '2025-2026', status: 'Graduated', startDate: '2025-07-01', email: 'ava.martinez.test@example.com', studentId: '2004-AM-9000009' },
  { firstName: 'Ethan', lastName: 'Davis', dob: '2006-04-17', fiscalYear: '2025-2026', status: 'Active', startDate: '2025-09-15', email: 'ethan.davis.test@example.com', studentId: '2006-ED-9000010' },
];

const FISCAL_YEAR_OPTIONS = ['2024-2025', '2025-2026', '2026-2027', '2027-2028'];
const STATUS_OPTIONS = ['Active', 'Inactive', 'Graduated', 'Withdrawn', 'Pending', 'Transferred', 'Other'];
const EDITABLE_COLUMNS = [
  'firstName', 'lastName', 'dob', 'fiscalYear', 'status', 'startDate', 'email', 'phone',
  'address', 'apt', 'city', 'state', 'zip',
];
const DATE_COLUMNS = ['dob', 'startDate'];
const NAME_COLUMNS = ['firstName', 'lastName'];
const ADDRESS_COLUMNS = ['address', 'city'];

function downloadCsv(url: string, filename: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
}

function normalizeDateValue(value: unknown) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!match) return text;

  const month = Number(match[1]);
  const day = Number(match[2]);
  const rawYear = Number(match[3]);
  const year = rawYear < 100 ? (rawYear >= 50 ? 1900 + rawYear : 2000 + rawYear) : rawYear;
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return text;
  }

  return [
    String(year).padStart(4, '0'),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-');
}

function toProperCase(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\b[a-z]/g, letter => letter.toUpperCase())
    .replace(/([-'’])[a-z]/g, match => match.toUpperCase());
}

// ─── Fuzzy matching helpers ───────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function nameSim(a: string, b: string): number {
  const na = a.toLowerCase().replace(/[^a-z]/g, '');
  const nb = b.toLowerCase().replace(/[^a-z]/g, '');
  const maxLen = Math.max(na.length, nb.length);
  return maxLen === 0 ? 1 : 1 - levenshtein(na, nb) / maxLen;
}

/** Returns true when two rows look like the same person but aren't exact matches. */
function isPossibleDuplicate(r1: Record<string, string>, r2: Record<string, string>): boolean {
  const fn1 = r1.firstName || '', ln1 = r1.lastName || '', dob1 = r1.dob || '';
  const fn2 = r2.firstName || '', ln2 = r2.lastName || '', dob2 = r2.dob || '';
  const full1 = `${fn1} ${ln1}`.trim();
  const full2 = `${fn2} ${ln2}`.trim();
  // Skip truly identical (already caught as "same name & DOB")
  if (full1.toLowerCase() === full2.toLowerCase() && dob1 === dob2) return false;

  const fullSim = nameSim(full1, full2);
  const lastSim = nameSim(ln1, ln2);
  const firstSim = nameSim(fn1, fn2);

  // Same DOB + names are ≥80% similar overall
  if (dob1 && dob1 === dob2 && fullSim >= 0.8) return true;

  // Same last name + same DOB + first name ≥60% similar (nickname / spelling variant)
  if (dob1 && dob1 === dob2 && lastSim >= 0.9 && firstSim >= 0.6) return true;

  // Very similar full name (≥90%) + DOB off by at most 1 year, same month+day (year typo)
  if (fullSim >= 0.9 && dob1 && dob2) {
    const [y1, m1, d1] = dob1.split('-');
    const [y2, m2, d2] = dob2.split('-');
    if (m1 === m2 && d1 === d2 && Math.abs(Number(y1) - Number(y2)) <= 1) return true;
  }

  return false;
}

// ─── Email normalisation ──────────────────────────────────────────────────────

// Values that mean "no email" — strip them so they don't enter the system
const NA_EMAIL_RE = /^(n\/?\.?a\.?|not\s+applicable|none|no\s+email|no|n\.a\.|-+|na\.?|null|undefined)$/i;

function cleanEmail(raw: string): string {
  const lower = raw.toLowerCase().trim();
  if (!lower || NA_EMAIL_RE.test(lower)) return '';
  return lower;
}

function pickUnitColumn(row: Record<string, string>): string {
  const keys = [
    'apt', 'Apt', 'APT', 'apartment', 'Apartment',
    'unit', 'Unit', 'UNIT', 'suite', 'Suite',
    'address2', 'Address2', 'addressLine2', 'AddressLine2',
  ];
  for (const key of keys) {
    const value = String(row[key] ?? '').trim();
    if (value) return value;
  }
  return '';
}

function mapAddressColumns(row: Record<string, string>) {
  const mapped = { ...row };
  if (mapped.Address && !mapped.address) mapped.address = mapped.Address;
  if (mapped.City && !mapped.city) mapped.city = mapped.City;
  if (mapped.State && !mapped.state) mapped.state = mapped.State;
  if (mapped.Zip && !mapped.zip) mapped.zip = mapped.Zip;

  const unit = pickUnitColumn(mapped);
  const addrNormalized = normalizeStudentAddress({
    address: mapped.address,
    apt: unit || mapped.apt,
    city: mapped.city,
    state: mapped.state,
    zip: mapped.zip,
  });
  mapped.address = addrNormalized.address;
  mapped.apt = addrNormalized.apt;
  mapped.city = addrNormalized.city;
  mapped.state = addrNormalized.state;
  mapped.zip = addrNormalized.zip;

  const deleteKeys = [
    'Address', 'City', 'State', 'Zip',
    'apt', 'Apt', 'APT', 'apartment', 'Apartment',
    'unit', 'Unit', 'UNIT', 'suite', 'Suite',
    'address2', 'Address2', 'addressLine2', 'AddressLine2',
  ];
  deleteKeys.forEach(key => { delete mapped[key]; });
  return mapped;
}

function normalizeUploadRows(rows: Record<string, string>[]) {
  return rows.map(row => {
    const normalized = Object.fromEntries(
      Object.entries(mapAddressColumns(row)).map(([key, value]) => [key, String(value ?? '').trim()])
    ) as Record<string, string>;

    DATE_COLUMNS.forEach((key) => {
      normalized[key] = normalizeDateValue(normalized[key]);
    });
    NAME_COLUMNS.forEach((key) => {
      normalized[key] = toProperCase(normalized[key]);
    });
    ADDRESS_COLUMNS.forEach((key) => {
      normalized[key] = toProperCase(normalized[key]);
    });
    normalized.email = cleanEmail(normalized.email || '');

    const addr = normalizeStudentAddress({
      address: normalized.address,
      apt: normalized.apt,
      city: normalized.city,
      state: normalized.state,
      zip: normalized.zip,
    });
    normalized.address = addr.address;
    normalized.apt = addr.apt;
    normalized.city = addr.city;
    normalized.state = addr.state;
    normalized.zip = addr.zip;

    return normalized;
  });
}

export default function BulkUploadPage() {
  const { data: session, status } = useSession();
  const [preview, setPreview] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [cabinets, setCabinets] = useState<any[]>([]);
  const [existingStudents, setExistingStudents] = useState<any[]>([]);
  const [selectedCabinet, setSelectedCabinet] = useState<any>(null);
  const [selectedDrawer, setSelectedDrawer] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState<string>('');
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [previewFilter, setPreviewFilter] = useState<'all' | 'ready' | 'issues'>('all');
  const [autoCreateCabinets, setAutoCreateCabinets] = useState(true);
  const [schoolAgencyId, setSchoolAgencyId] = useState<string>('');
  const [geoclientConfigured, setGeoclientConfigured] = useState<boolean | null>(null);
  const [geoclientVerifying, setGeoclientVerifying] = useState(false);
  const [geoclientByIndex, setGeoclientByIndex] = useState<Record<number, {
    status: string;
    warnings: string[];
    standardized?: { address: string; apt?: string; city: string; state: string; zip: string };
  }>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch cabinets, existing students, and school agency ID on component mount
  React.useEffect(() => {
    if (status !== 'authenticated') return;
    async function fetchUploadContext() {
      try {
        const [cabinetRes, studentRes, schoolRes] = await Promise.all([
          fetch('/api/cabinets'),
          fetch('/api/students'),
          fetch('/api/admin/schools'),
        ]);
        const cabinetsData = await cabinetRes.json();
        const studentsData = await studentRes.json();
        const schoolsData = await schoolRes.json();
        setCabinets(Array.isArray(cabinetsData) ? cabinetsData : []);
        setExistingStudents(Array.isArray(studentsData) ? studentsData : []);

        // Find the agencyId for the user's school
        const userSchool = (session?.user as any)?.school || '';
        if (userSchool && Array.isArray(schoolsData)) {
          const schoolDoc = schoolsData.find(
            (s: any) => s.name?.toLowerCase() === userSchool.toLowerCase()
          );
          setSchoolAgencyId(resolveAgencyId(userSchool, schoolDoc?.agencyId));
        }
      } catch (error) {
        console.error('Failed to fetch bulk upload context:', error);
      }
    }
    fetchUploadContext();
    fetch('/api/admin/addresses/verify')
      .then(r => r.json())
      .then(d => setGeoclientConfigured(Boolean(d.configured)))
      .catch(() => setGeoclientConfigured(false));
  }, [status, session]);

  function isValidDate(value: any) {
    if (!value) return false;
    const date = new Date(value);
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value)) && !Number.isNaN(date.getTime());
  }

  function getEmailIssue(value: any): string | null {
    if (!value) return null;
    const email = String(value).trim();
    if (!email) return null;
    if (/\s/.test(email)) return 'Email has spaces';
    const atCount = (email.match(/@/g) || []).length;
    if (atCount === 0) return 'Email missing @ sign';
    if (atCount > 1) return `Email has ${atCount} @ signs`;
    const [local, domain] = email.split('@');
    if (!local) return 'Email missing username before @';
    if (!domain) return 'Email missing domain after @';
    if (!domain.includes('.')) return 'Email missing domain extension';
    const ext = domain.split('.').pop() || '';
    if (ext.length < 2) return 'Email extension too short';
    if (/[^a-zA-Z0-9._%+\-@]/.test(email)) return 'Email has invalid characters';
    return null;
  }

  /** Returns the Label ID (barcode format: {year}-{initials}-{counter}) */
  function getLabelId(row: any, index: number): string {
    // If the CSV already provides a labelId or an old-style studentId, use it
    if (row.labelId) return String(row.labelId);
    if (row.studentId && /^\d{4}-[A-Z]{2}-\d{7}$/i.test(String(row.studentId))) {
      return String(row.studentId);
    }
    const { firstName = '', lastName = '', dob = '' } = row;
    return generateLabelId(firstName, lastName, dob, index + 1);
  }

  /** Returns the demographic Student ID ({LAST}{FIRST}{AGENCY}{DOB_DIGITS}) */
  function getGeneratedStudentId(row: any): string {
    const { firstName = '', lastName = '', dob = '' } = row;
    if (!firstName || !lastName || !dob) return '';
    return generateStudentId(firstName, lastName, schoolAgencyId || 'R00', dob);
  }

  const selectedDrawerInfo = selectedCabinet?.drawers?.find((drawer: any) => drawer._id === selectedDrawer);

  const validationRows = React.useMemo(() => {
    // ── Existing-student lookup maps ────────────────────────────────────────
    const existingEmailMap = new Map<string, string>();
    const existingStudentIds = new Set(
      existingStudents.flatMap(s => [s.labelId, s.studentId]).filter(Boolean)
    );
    const existingNameDob = new Set(existingStudents.map(s =>
      `${s.firstName || ''}|${s.lastName || ''}|${s.dob || ''}`.toLowerCase()
    ));
    // DOB-indexed existing students for O(1) fuzzy candidate lookup
    const existingByDob = new Map<string, any[]>();
    existingStudents.forEach(s => {
      const e = s.email?.toLowerCase();
      if (e) existingEmailMap.set(e, `${s.firstName || ''} ${s.lastName || ''}`.trim());
      if (s.dob) {
        const arr = existingByDob.get(s.dob) || [];
        arr.push(s);
        existingByDob.set(s.dob, arr);
      }
    });

    // ── In-file maps ────────────────────────────────────────────────────────
    const fileEmailRows = new Map<string, { name: string; index: number }[]>();
    const fileStudentIds = new Map<string, number>();
    const fileNameDob = new Map<string, number>();
    // DOB-indexed file rows for O(1) fuzzy candidate lookup
    const fileByDob = new Map<string, { row: Record<string, string>; index: number }[]>();

    preview.forEach((row, index) => {
      const email = row.email?.toLowerCase();
      const labelId = getLabelId(row, index);
      const nameDob = `${row.firstName || ''}|${row.lastName || ''}|${row.dob || ''}`.toLowerCase();
      const name = `${row.firstName || ''} ${row.lastName || ''}`.trim() || `Row ${index + 1}`;
      if (email) {
        const arr = fileEmailRows.get(email) || [];
        arr.push({ name, index });
        fileEmailRows.set(email, arr);
      }
      if (labelId) fileStudentIds.set(labelId, (fileStudentIds.get(labelId) || 0) + 1);
      fileNameDob.set(nameDob, (fileNameDob.get(nameDob) || 0) + 1);
      if (row.dob && row.firstName && row.lastName) {
        const arr = fileByDob.get(row.dob) || [];
        arr.push({ row, index });
        fileByDob.set(row.dob, arr);
      }
    });

    return preview.map((row, index) => {
      const issues: string[] = [];
      const warnings: string[] = [];
      const email = row.email?.toLowerCase();
      const labelId = getLabelId(row, index);
      const studentId = getGeneratedStudentId(row);
      const nameDob = `${row.firstName || ''}|${row.lastName || ''}|${row.dob || ''}`.toLowerCase();

      if (!row.firstName) issues.push('Missing first name');
      if (!row.lastName) issues.push('Missing last name');
      if (!isValidDate(row.dob)) issues.push('Invalid DOB');
      if (!isValidDate(row.startDate)) issues.push('Invalid start date');
      if (!FISCAL_YEAR_OPTIONS.includes(row.fiscalYear)) issues.push('Unknown fiscal year');
      if (!STATUS_OPTIONS.includes(row.status)) issues.push('Unknown status');
      const emailIssue = getEmailIssue(row.email);
      if (emailIssue) issues.push(emailIssue);
      if (!selectedCabinet) issues.push('Missing cabinet');
      if (!selectedDrawer) issues.push('Missing drawer');
      if (labelId && existingStudentIds.has(labelId)) issues.push('Duplicate label ID already exists');
      if (labelId && (fileStudentIds.get(labelId) || 0) > 1) issues.push('Duplicate label ID in file');
      if (email && existingEmailMap.has(email)) {
        issues.push(`Dup. email in system: ${existingEmailMap.get(email)}`);
      }
      if (email) {
        const others = (fileEmailRows.get(email) || []).filter(r => r.index !== index);
        if (others.length > 0) {
          issues.push(`Dup. email in file: ${others.map(r => r.name).join(', ')}`);
        }
      }
      if (row.firstName && row.lastName && row.dob && existingNameDob.has(nameDob)) issues.push('Same name & DOB already in system');
      if (row.firstName && row.lastName && row.dob && (fileNameDob.get(nameDob) || 0) > 1) issues.push('Same name & DOB repeated in file');

      const addressCheck = validateStudentAddress({
        address: row.address,
        apt: row.apt,
        city: row.city,
        state: row.state,
        zip: row.zip,
      });
      if (addressCheck.status === 'warning') {
        addressCheck.warnings.forEach(w => warnings.push(`Address: ${w}`));
      }

      const geo = geoclientByIndex[index];
      if (geo) {
        if (geo.status === 'verified') {
          warnings.push('Geoclient: verified');
        } else if (geo.status === 'not_found') {
          warnings.push('Geoclient: address not found in NYC');
        } else if (geo.status === 'warning') {
          geo.warnings.forEach(w => warnings.push(`Geoclient: ${w}`));
        } else if (geo.status === 'error') {
          geo.warnings.forEach(w => warnings.push(`Geoclient: ${w}`));
        }
      }

      // ── Fuzzy "possible same person" warnings ──────────────────────────────
      // Only compare within same-DOB bucket — O(k) not O(n). Most DOBs are
      // unique so k ≈ 1–3, keeping this fast even for thousands of rows.
      if (row.firstName && row.lastName && row.dob) {
        const sameDobFile = (fileByDob.get(row.dob) || []).filter(r => r.index !== index);
        sameDobFile.forEach(({ row: other }) => {
          if (isPossibleDuplicate(row, other)) {
            warnings.push(`Possible same person (file): ${other.firstName} ${other.lastName}`);
          }
        });

        const sameDobExisting = existingByDob.get(row.dob) || [];
        sameDobExisting.forEach(s => {
          if (isPossibleDuplicate(row, s)) {
            warnings.push(`Possible same person (system): ${s.firstName} ${s.lastName}`);
          }
        });
      }

      return { row, index, labelId, studentId, issues, warnings };
    });
  }, [preview, existingStudents, selectedCabinet, selectedDrawer, geoclientByIndex]);

  const issueCount = validationRows.reduce((sum, row) => sum + row.issues.length, 0);
  const rowsWithIssues = validationRows.filter(row => row.issues.length > 0);
  const readyRows = validationRows.filter(row => row.issues.length === 0);
  const warningCount = validationRows.reduce((sum, row) => sum + row.warnings.length, 0);
  const filteredValidationRows = validationRows
    .filter(row => {
      if (previewFilter === 'ready') return row.issues.length === 0;
      if (previewFilter === 'issues') return row.issues.length > 0;
      return true;
    })
    .sort((a, b) => (a.row.lastName || '').toLowerCase().localeCompare((b.row.lastName || '').toLowerCase()));
  const drawerAvailable = selectedDrawerInfo
    ? (selectedDrawerInfo.capacity || 0) - (selectedDrawerInfo.currentCount || 0)
    : 0;
  const storageIssue = !autoCreateCabinets && selectedDrawerInfo && readyRows.length > drawerAvailable
    ? `Selected drawer only has ${drawerAvailable} available spaces for ${readyRows.length} ready students.`
    : '';

  function updatePreviewCell(index: number, key: string, value: string) {
    setPreview(current => current.map((row, rowIndex) => (
      rowIndex === index ? { ...row, [key]: value } : row
    )));
  }

  function deletePreviewRow(index: number) {
    setPreview(current => current.filter((_, rowIndex) => rowIndex !== index));
  }

  function handleDrag(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile({ target: { files: e.dataTransfer.files } } as any);
    }
  }

  function handleBrowseClick() {
    inputRef.current?.click();
  }

  async function handleGeoclientVerify() {
    setGeoclientVerifying(true);
    setError('');
    try {
      const rows = preview
        .map((row, index) => ({
          index,
          address: row.address,
          apt: row.apt,
          city: row.city,
          state: row.state,
          zip: row.zip,
        }))
        .filter(r => r.address || r.apt || r.city || r.zip);

      if (rows.length === 0) {
        setError('No address fields found in the preview to verify.');
        return;
      }

      const res = await fetch('/api/admin/addresses/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'preview', rows, limit: 100 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'NYC Geoclient verification failed.');
        return;
      }

      const map: typeof geoclientByIndex = {};
      for (const item of data.results || []) {
        map[item.index] = {
          status: item.status,
          warnings: item.warnings || [],
          standardized: item.standardized,
        };
      }
      setGeoclientByIndex(map);
    } catch {
      setError('NYC Geoclient verification failed. Check API keys and try again.');
    } finally {
      setGeoclientVerifying(false);
    }
  }

  function applyGeoclientStandardized() {
    setPreview(current => current.map((row, index) => {
      const geo = geoclientByIndex[index];
      if (!geo?.standardized || !['verified', 'warning'].includes(geo.status)) return row;
      return {
        ...row,
        address: geo.standardized.address || row.address,
        apt: geo.standardized.apt || row.apt,
        city: geo.standardized.city || row.city,
        state: geo.standardized.state || row.state,
        zip: geo.standardized.zip || row.zip,
      };
    }));
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError('');
    setSuccess('');
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      if (!data) return;
      try {
        setPreview(normalizeUploadRows(parseCsvToObjects(String(data))));
        setGeoclientByIndex({});
      } catch (err) {
        setError('Failed to parse file. Please ensure it is a valid CSV file.');
        setPreview([]);
        setFileName('');
      }
    };
    reader.readAsText(file);
  }

  function handleCabinetChange(value: string) {
    const cabinet = cabinets.find(c => c._id === value);
    setSelectedCabinet(cabinet || null);
    setSelectedDrawer(''); // Reset drawer selection when cabinet changes
  }

  async function handleUpload() {
    setUploading(true);
    setSuccess('');
    setError('');
    let successCount = 0;
    try {
      if (status !== 'authenticated') {
        setError('You must be logged in to upload.');
        setUploading(false);
        return;
      }
      if (!selectedCabinet) {
        setError('Please select a cabinet.');
        setUploading(false);
        return;
      }
      if (!selectedDrawer) {
        setError('Please select a drawer.');
        setUploading(false);
        return;
      }
      if (readyRows.length === 0) {
        setError('There are no ready students to upload yet. Fix at least one row first.');
        setUploading(false);
        return;
      }
      if (storageIssue) {
        setError('Please choose a drawer with enough space for the ready students.');
        setUploading(false);
        return;
      }
      const studentsToUpload = readyRows.map((validationRow) => {
        const student = { ...validationRow.row };
        const addressCheck = validateStudentAddress({
          address: student.address,
          apt: student.apt,
          city: student.city,
          state: student.state,
          zip: student.zip,
        });
        student.address = addressCheck.normalized.address || undefined;
        student.apt = addressCheck.normalized.apt || undefined;
        student.city = addressCheck.normalized.city || undefined;
        student.state = addressCheck.normalized.state || undefined;
        student.zip = addressCheck.normalized.zip || undefined;
        const geo = geoclientByIndex[validationRow.index];
        student.addressFlags = [
          ...(addressCheck.flags || []),
          ...(geo?.warnings?.length ? ['geoclient_checked'] : []),
        ];
        student.addressValidationStatus = geo?.status === 'verified'
          ? 'verified'
          : geo?.status === 'not_found'
            ? 'not_found'
            : addressCheck.status;
        if (geo?.standardized && ['verified', 'warning'].includes(geo.status)) {
          student.addressStandardized = geo.standardized;
        }
        // Always set labelId (barcode ID) and let the server generate the demographic studentId
        student.labelId = validationRow.labelId;
        // Remove any legacy studentId from the CSV so the server generates the new demographic one
        delete student.studentId;
        return student;
      });

      const res = await fetch('/api/students/bulk-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          students: studentsToUpload,
          targetCabinetId: selectedCabinet._id,
          targetDrawerId: selectedDrawer,
          autoCreateCabinets,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || 'Bulk upload failed.');
        setUploading(false);
        return;
      }

      const data = await res.json();
      successCount = data.insertedCount || studentsToUpload.length;
      const uploadedIndexes = new Set(readyRows.map(row => row.index));
      setSuccess(`Successfully imported ${successCount} ready student${successCount !== 1 ? 's' : ''}.${data.cabinetsCreated ? ` Created ${data.cabinetsCreated} new cabinet${data.cabinetsCreated !== 1 ? 's' : ''}.` : ''} ${rowsWithIssues.length ? `${rowsWithIssues.length} row${rowsWithIssues.length !== 1 ? 's' : ''} still need fixing.` : ''}`);
      setPreview(current => current.filter((_, index) => !uploadedIndexes.has(index)));
      setPreviewFilter(rowsWithIssues.length ? 'issues' : 'all');
      const refreshedCabinets = await fetch('/api/cabinets').then(response => response.json()).catch(() => null);
      if (Array.isArray(refreshedCabinets)) setCabinets(refreshedCabinets);
      if (rowsWithIssues.length === 0) {
        setFileName('');
        setSelectedCabinet(null);
        setSelectedDrawer('');
      }
    } catch (err) {
      setError('Error uploading students. Please check your data.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="w-full p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-foreground">Bulk Upload Students</h1>
          <p className="text-muted-foreground mt-2">
            Upload a CSV file with student data. Cabinet and drawer are selected below for the whole upload.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <Button variant="outline" onClick={() => setHelpModalOpen(true)} className="gap-2">
            <HelpCircle className="h-4 w-4" />
            How to Upload
          </Button>
          <Button variant="outline" onClick={() => downloadCsv('/student_bulk_upload_template.csv', 'student_bulk_upload_template.csv')} className="gap-2">
            <Download className="h-4 w-4" />
            CSV Template
          </Button>
          <Button variant="outline" onClick={() => downloadCsv('/student_bulk_upload_sample.csv', 'student_bulk_upload_sample.csv')} className="gap-2">
            <FileText className="h-4 w-4" />
            Sample CSV
          </Button>
        </div>
      </div>

      <Separator />

      {/* Cabinet and Drawer Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Storage Assignment
          </CardTitle>
          <CardDescription>
            Select a cabinet and drawer for all students in this upload
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cabinet">Cabinet for All Students</Label>
            <Select
              value={selectedCabinet?._id || ''}
              onValueChange={handleCabinetChange}
            >
              <SelectTrigger id="cabinet">
                <SelectValue placeholder="Select a cabinet" />
              </SelectTrigger>
              <SelectContent>
                {cabinets.length === 0 ? (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    No cabinets available
                  </div>
                ) : (
                  cabinets.map((cabinet) => (
                    <SelectItem key={cabinet._id} value={cabinet._id}>
                      {cabinet.identifier ? `${cabinet.name} (${cabinet.identifier})` : cabinet.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {selectedCabinet && (
            <div className="space-y-2">
              <Label htmlFor="drawer">Drawer for All Students</Label>
              <Select
                value={selectedDrawer}
                onValueChange={setSelectedDrawer}
              >
                <SelectTrigger id="drawer">
                  <SelectValue placeholder="Select a drawer" />
                </SelectTrigger>
                <SelectContent>
                  {selectedCabinet.drawers && selectedCabinet.drawers.length > 0 ? (
                    selectedCabinet.drawers.map((drawer: any) => (
                      <SelectItem key={drawer._id} value={drawer._id}>
                        {drawer.name} ({drawer.currentCount || 0}/{drawer.capacity} used)
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      No drawers available
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}
          {selectedCabinet && selectedDrawer && (
            <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-3">
              <Checkbox
                id="auto-create-cabinets"
                checked={autoCreateCabinets}
                onCheckedChange={(checked) => setAutoCreateCabinets(checked === true)}
              />
              <div className="space-y-1">
                <Label htmlFor="auto-create-cabinets" className="cursor-pointer">
                  Smart allocate and create next cabinets if needed
                </Label>
                <p className="text-sm text-muted-foreground">
                  Starts with the selected drawer, fills the next available drawers, and creates the next cabinet range from this pattern when capacity runs out. Example: Main Cabinet A-D creates Main Cabinet E-H.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* File Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload File
          </CardTitle>
          <CardDescription>
            Drag and drop your file here, or click to browse
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`
              relative border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all
              ${dragActive 
                ? 'border-primary bg-primary/5' 
                : 'border-border bg-muted/50 hover:bg-muted'
              }
            `}
            onClick={handleBrowseClick}
          >
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFile}
              className="hidden"
              ref={inputRef}
            />
            <div className="flex flex-col items-center gap-4">
              {dragActive ? (
                <>
                  <Upload className="h-12 w-12 text-primary" />
                  <p className="text-lg font-medium text-foreground">Drop your file here...</p>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="h-12 w-12 text-muted-foreground" />
                  <div>
                    <p className="text-lg font-medium text-foreground mb-1">
                      Drag and drop your file here
                    </p>
                    <p className="text-sm text-muted-foreground">
                      or click to browse for a file
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Supports .csv files
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
          {fileName && (
            <div className="mt-4 flex items-center flex-wrap gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">{fileName}</span>
              <Badge variant="secondary">{preview.length} students</Badge>
              {issueCount > 0 && <Badge variant="destructive">{issueCount} issue(s)</Badge>}
              {warningCount > 0 && (
                <Badge className="bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700">
                  ⚠ {warningCount} warning{warningCount !== 1 ? 's' : ''} (duplicates / addresses)
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Table */}
      {preview.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Preview ({preview.length} students)
                </CardTitle>
                <CardDescription>
                  Review and fix validation issues before uploading
                </CardDescription>
              </div>
              <Button
                onClick={handleUpload}
                disabled={uploading || !selectedCabinet || !selectedDrawer || readyRows.length === 0 || Boolean(storageIssue)}
                size="lg"
                className="gap-2"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Upload Ready Students ({readyRows.length})
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {storageIssue && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Not enough drawer capacity</AlertTitle>
                <AlertDescription>{storageIssue}</AlertDescription>
              </Alert>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Alert variant={issueCount > 0 ? 'destructive' : 'success'}>
                {issueCount > 0 ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                <AlertDescription>
                  {rowsWithIssues.length > 0 ? `${rowsWithIssues.length} row(s) need fixing` : 'No validation issues found'}
                </AlertDescription>
              </Alert>
              <Alert>
                <Users className="h-4 w-4" />
                <AlertDescription>{readyRows.length} row(s) ready to upload</AlertDescription>
              </Alert>
              <Alert>
                <Building2 className="h-4 w-4" />
                <AlertDescription>
                  {selectedDrawerInfo
                    ? autoCreateCabinets
                      ? `${drawerAvailable} spaces in selected drawer, more will be allocated automatically`
                      : `${drawerAvailable} available spaces in selected drawer`
                    : 'Select storage assignment'}
                </AlertDescription>
              </Alert>
            </div>
            {geoclientConfigured === false && (
              <Alert>
                <MapPin className="h-4 w-4" />
                <AlertTitle>NYC Geoclient not configured</AlertTitle>
                <AlertDescription>
                  Add <code className="text-xs">NYC_GEOCLIENT_SUBSCRIPTION_KEY</code> (or{' '}
                  <code className="text-xs">NYC_GEOCLIENT_APP_KEY</code>) from the NYC API portal.
                </AlertDescription>
              </Alert>
            )}
            {geoclientConfigured && (
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-blue-200 bg-blue-50/60 dark:bg-blue-950/20 dark:border-blue-800 p-3">
                <MapPin className="h-4 w-4 text-blue-600 shrink-0" />
                <div className="flex-1 min-w-[200px]">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">NYC Geoclient (Phase 2)</p>
                  <p className="text-xs text-blue-800/90 dark:text-blue-200/90">
                    Verify NYC addresses against official Geosupport data. Imports still save as entered unless you apply standardized values.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 bg-background"
                  disabled={geoclientVerifying}
                  onClick={handleGeoclientVerify}
                >
                  {geoclientVerifying
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Verifying…</>
                    : <><MapPin className="h-3.5 w-3.5" /> Verify addresses</>}
                </Button>
                {Object.keys(geoclientByIndex).length > 0 && (
                  <Button type="button" size="sm" variant="secondary" onClick={applyGeoclientStandardized}>
                    Apply standardized
                  </Button>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-2">
              <span className="px-1 text-sm font-medium text-muted-foreground">Show:</span>
              <Button
                type="button"
                variant={previewFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPreviewFilter('all')}
              >
                All ({validationRows.length})
              </Button>
              <Button
                type="button"
                variant={previewFilter === 'ready' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPreviewFilter('ready')}
              >
                Ready ({readyRows.length})
              </Button>
              <Button
                type="button"
                variant={previewFilter === 'issues' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPreviewFilter('issues')}
              >
                Needs Fixing ({rowsWithIssues.length})
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="font-medium">Badge legend:</span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-full bg-destructive" />
                Red = blocking issue (must fix before upload)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-full bg-amber-400" />
                Amber = possible duplicate person (fuzzy match — may be a twin or sibling, upload still allowed)
              </span>
            </div>
            {previewFilter === 'issues' && rowsWithIssues.length > 0 && (
              <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-2 text-sm text-amber-800 dark:text-amber-300">
                <Pencil className="h-4 w-4 shrink-0" />
                All fields are editable — click any cell to fix the value directly. Changes are validated instantly.
              </div>
            )}
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Issues</TableHead>
                    {EDITABLE_COLUMNS.map((key) => (
                      <TableHead key={key} className="font-semibold">
                        <span className="flex items-center gap-1">
                          {key}
                          <Pencil className="h-3 w-3 text-muted-foreground opacity-50" />
                        </span>
                      </TableHead>
                    ))}
                    <TableHead className="min-w-[160px]">
                      <div className="flex flex-col leading-tight">
                        <span>Label ID</span>
                        <span className="text-[10px] font-normal text-muted-foreground">Student ID</span>
                      </div>
                    </TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredValidationRows.slice(0, previewFilter === 'issues' ? undefined : 25).map(({ row, index, labelId, studentId, issues, warnings }) => {
                    const issueFields = new Set<string>();
                    if (!row.firstName) issueFields.add('firstName');
                    if (!row.lastName) issueFields.add('lastName');
                    if (!isValidDate(row.dob)) issueFields.add('dob');
                    if (!isValidDate(row.startDate)) issueFields.add('startDate');
                    if (!FISCAL_YEAR_OPTIONS.includes(row.fiscalYear)) issueFields.add('fiscalYear');
                    if (!STATUS_OPTIONS.includes(row.status)) issueFields.add('status');
                    if (getEmailIssue(row.email)) issueFields.add('email');
                    const rowBg = issues.length > 0
                      ? 'bg-destructive/5'
                      : warnings.length > 0
                        ? 'bg-amber-50 dark:bg-amber-950/20'
                        : '';
                    return (
                      <TableRow key={index} className={rowBg}>
                        <TableCell>
                          {issues.length === 0 && warnings.length === 0 ? (
                            <Badge variant="outline">OK</Badge>
                          ) : (
                            <div className="flex flex-col gap-1">
                              {issues.map((issue) => (
                                <Badge key={issue} variant="destructive" className="w-fit text-xs whitespace-normal h-auto py-0.5 leading-snug">
                                  {issue}
                                </Badge>
                              ))}
                              {warnings.map((warn) => (
                                <Badge key={warn} className="w-fit text-xs whitespace-normal h-auto py-0.5 leading-snug bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700">
                                  ⚠ {warn}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        {EDITABLE_COLUMNS.map((key) => {
                          const hasIssue = issueFields.has(key);
                          return (
                            <TableCell key={key} className="min-w-[160px]">
                              {key === 'fiscalYear' ? (
                                <Select
                                  value={row[key] || ''}
                                  onValueChange={(value) => updatePreviewCell(index, key, value)}
                                >
                                  <SelectTrigger className={hasIssue ? 'border-destructive ring-1 ring-destructive' : ''}>
                                    <SelectValue placeholder="Fiscal year" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {FISCAL_YEAR_OPTIONS.map((year) => (
                                      <SelectItem key={year} value={year}>{year}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : key === 'status' ? (
                                <Select
                                  value={row[key] || ''}
                                  onValueChange={(value) => updatePreviewCell(index, key, value)}
                                >
                                  <SelectTrigger className={hasIssue ? 'border-destructive ring-1 ring-destructive' : ''}>
                                    <SelectValue placeholder="Status" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {STATUS_OPTIONS.map((status) => (
                                      <SelectItem key={status} value={status}>{status}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Input
                                  type={key === 'dob' || key === 'startDate' ? 'date' : key === 'email' ? 'email' : 'text'}
                                  value={row[key] || ''}
                                  onChange={(e) => updatePreviewCell(index, key, e.target.value)}
                                  className={hasIssue ? 'border-destructive ring-1 ring-destructive focus-visible:ring-destructive' : ''}
                                />
                              )}
                            </TableCell>
                          );
                        })}
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-mono text-xs font-medium">{labelId}</span>
                            {studentId && (
                              <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[160px]" title={studentId}>
                                {studentId}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="w-10">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title="Remove this row from the upload"
                            onClick={() => deletePreviewRow(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {previewFilter !== 'issues' && filteredValidationRows.length > 25 && (
              <p className="text-sm text-muted-foreground mt-4 text-center">
                Showing first 25 of {filteredValidationRows.length} {previewFilter === 'all' ? 'students' : 'ready students'}. Switch to <strong>Needs Fixing</strong> to see all rows with issues.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Success Message */}
      {success && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertTitle className="text-green-800 dark:text-green-200">Success!</AlertTitle>
          <AlertDescription className="text-green-700 dark:text-green-300">
            {success}
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

      <Dialog open={helpModalOpen} onOpenChange={setHelpModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              How to Bulk Upload Students
            </DialogTitle>
            <DialogDescription>
              Use bulk upload when you need to create many student records and assign them to the same cabinet/drawer.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <Alert>
              <FileSpreadsheet className="h-4 w-4" />
              <AlertTitle>Recommended workflow</AlertTitle>
              <AlertDescription>
                Download the CSV template or sample file, fill in student details, select the cabinet/drawer on this page, upload the file, fix preview issues, then click Upload Students.
              </AlertDescription>
            </Alert>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Required columns</CardTitle>
                  <CardDescription>These columns are validated before upload.</CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">
{`firstName,lastName,dob,fiscalYear,status,startDate,email,phone,studentId,address,apt,city,state,zip`}
                  </pre>
                  <p className="text-sm text-muted-foreground mt-3">
                    `studentId` is optional. Address columns are optional — imported as entered, with amber warnings for likely NYC/ZIP mismatches.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Valid examples</CardTitle>
                  <CardDescription>Dates must use YYYY-MM-DD format.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p><strong>DOB:</strong> 2006-01-12</p>
                  <p><strong>Fiscal Year:</strong> 2025-2026</p>
                  <p><strong>Status:</strong> Active, Inactive, Graduated, Withdrawn, Pending, Transferred, Other</p>
                  <p><strong>Email:</strong> Optional, but must be valid if provided.</p>
                </CardContent>
              </Card>
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <h3 className="font-semibold">Important notes</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  Cabinet and drawer are not required in the file because you select one storage location for the entire upload.
                </li>
                <li className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  The preview checks duplicate student IDs, duplicate emails, same name + DOB, invalid dates, unknown statuses, drawer capacity, and address/ZIP mismatches (warnings only — upload still proceeds).
                </li>
                <li className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  Apartment/unit can be in the <code className="text-xs">address</code> column (e.g. <code className="text-xs">690 Grand St Apt 4B</code>) or a separate <code className="text-xs">apt</code>, <code className="text-xs">unit</code>, or <code className="text-xs">address2</code> column — it is stored in its own <code className="text-xs">apt</code> field and kept after NYC Geoclient verify.
                </li>
                <li className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  Addresses import as entered. NYC ZIP/city checks flag likely errors (e.g. Queens address with Manhattan ZIP). Use Verify addresses to apply standardized building data while keeping the apt.
                </li>
                <li className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  If the selected drawer does not have enough space, choose another drawer or split the upload.
                </li>
                <li className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  You can edit visible preview rows inline before saving.
                </li>
              </ul>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => downloadCsv('/student_bulk_upload_template.csv', 'student_bulk_upload_template.csv')}>
                CSV Template
              </Button>
              <Button variant="outline" onClick={() => downloadCsv('/student_bulk_upload_sample.csv', 'student_bulk_upload_sample.csv')}>
                Sample CSV
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setHelpModalOpen(false)}>
              Close
            </Button>
            <Button onClick={() => {
              setHelpModalOpen(false);
              inputRef.current?.click();
            }}>
              Choose File
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 