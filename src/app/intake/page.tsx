'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Barcode from 'react-barcode';
import QRCodeComponent from '@/components/QRCode';
import GoogleTranslate from '@/components/GoogleTranslate';
import { buildStudentQrPayload } from '@/lib/qrPayload';
import { isStudentSearchQueryValid } from '@/lib/studentSearch';
import { DEFAULT_INTAKE_ACTIVITIES, DEFAULT_INTAKE_SESSIONS } from '@/lib/intakeDefaults';
import { findNextAvailableSlot, studentNeedsActiveDrawer, type NextCabinetSlot } from '@/lib/cabinets';
import { formatHumanDate } from '@/lib/utils';
import {
  beEslAgeErrorMessage,
  beEslAgeHintMessage,
  checkBeEslAgeEligibility,
  requiresBeEslAgeCheck,
} from '@/lib/beEslEligibility';
import { Cabinet } from '@/types/cabinet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  UserPlus, AlertCircle, CheckCircle2, Printer, RotateCcw,
  Loader2, User, Calendar, Phone, Mail, ClipboardList, LogOut, Building2,
  FolderOpen, ChevronRight, List, RefreshCw, Clock, CalendarDays,
  Users, ShieldAlert, Copy, Check,
} from 'lucide-react';

const INTAKE_STATUS_OPTIONS = [
  { value: 'NEW',               label: 'NEW',               description: 'First-time student' },
  { value: 'RETURNING',         label: 'RETURNING',         description: 'Previously enrolled student' },
  { value: 'Continuing Intake', label: 'Continuing Intake', description: 'Student who started but didn\'t complete intake' },
  { value: 'CTE Orientation',   label: 'CTE Orientation',   description: 'Career & Technical Education orientation' },
  { value: 'Other',             label: 'Other',             description: 'Other purpose — describe below' },
];

interface CheckResult {
  status: 'idle' | 'checking' | 'found' | 'clear';
  exact: any[];
  fuzzy: any[];
}

interface NextSlot extends NextCabinetSlot {}

// Current local time as an "HH:MM" string for <input type="time">
function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Parse "HH:MM" → minutes-of-day, or null.
function parseMinutes(t: unknown): number | null {
  if (typeof t !== 'string') return null;
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10), min = parseInt(m[2], 10);
  if (isNaN(h) || isNaN(min)) return null;
  return h * 60 + min;
}

// Duration of a single visit in minutes (handles past-midnight rollover).
function visitMinutes(timeIn: unknown, timeOut: unknown): number | null {
  const a = parseMinutes(timeIn), b = parseMinutes(timeOut);
  if (a === null || b === null) return null;
  let diff = b - a;
  if (diff < 0) diff += 24 * 60;
  return diff;
}

// Sum minutes across a student's visit log.
function totalVisitMinutes(visits: any[] | undefined): number {
  if (!Array.isArray(visits)) return 0;
  return visits.reduce((sum, v) => sum + (visitMinutes(v?.timeIn, v?.timeOut) ?? 0), 0);
}

// Format minutes as "1h 25m".
function fmtHM(mins: number): string {
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const emptyForm = () => ({
  // Identity
  firstName: '',
  lastName: '',
  dob: '',
  phone: '',
  email: '',
  // Intake type
  intakeStudentStatus: 'NEW',
  otherNote: '',
  // NEW-specific
  gender: '',                // M | F
  startDate: new Date().toISOString().split('T')[0],
  // RETURNING / CTE / Continuing-specific
  originalStartDate: '',
  // Shared intake fields
  educationStatus: '',       // BE | ESL
  intakeActivity: [] as string[],
  placementClass: '',
  intakeSession: '',
  timeIn: nowHHMM(),         // defaults to the current time on load
  isLeaving: '',             // Leaving | Staying
  timeOut: '',               // required when isLeaving === 'Leaving'
  // File assignment
  cabinet: '',
  drawer: '',
  // Misc
  notes: '',
});

export default function IntakePage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();

  const [form, setForm] = useState(emptyForm());
  const [cabinets, setCabinets] = useState<Cabinet[]>([]);
  const [cabinetsLoading, setCabinetsLoading] = useState(false);
  const [nextSlot, setNextSlot] = useState<NextSlot | null>(null);

  const [checkResult, setCheckResult] = useState<CheckResult>({ status: 'idle', exact: [], fuzzy: [] });
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [savedStudent, setSavedStudent] = useState<any>(null);
  const [confirmDupeOpen, setConfirmDupeOpen] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);

  const [activeTab, setActiveTab] = useState('register');
  const [historyStudents, setHistoryStudents] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<'today' | 'week'>('today');
  const [historyScope, setHistoryScope] = useState<'mine' | 'all'>('mine');

  // Sibling / same-name flag
  const [siblingAcknowledged, setSiblingAcknowledged] = useState(false);

  // Data Lead contact for this school
  const [dataLead, setDataLead] = useState<{ name: string; email: string; role: string } | null>(null);

  // Intake sessions, activities, and fiscal year (school-level config)
  const [intakeSessions, setIntakeSessions] = useState<string[]>(DEFAULT_INTAKE_SESSIONS);
  const [intakeActivityOptions, setIntakeActivityOptions] = useState<string[]>(DEFAULT_INTAKE_ACTIVITIES);
  const [currentFiscalYear, setCurrentFiscalYear] = useState('2025-2026');

  // Continuing Intake student search
  const [studentSearch, setStudentSearch] = useState('');
  const [studentSearchResults, setStudentSearchResults] = useState<any[]>([]);
  const [studentSearchLoading, setStudentSearchLoading] = useState(false);
  const [selectedExistingStudent, setSelectedExistingStudent] = useState<any>(null);

  const checkTimeout = useRef<NodeJS.Timeout | null>(null);

  const beEslAgeCheck = useMemo(
    () => (form.dob ? checkBeEslAgeEligibility(form.dob) : null),
    [form.dob],
  );
  const beEslAgeBlocked = Boolean(
    beEslAgeCheck
    && requiresBeEslAgeCheck(form)
    && !beEslAgeCheck.eligible,
  );

  // Auth guard — redirect non-Intake roles away, redirect guests to sign-in
  useEffect(() => {
    if (authStatus === 'loading') return;
    if (authStatus === 'unauthenticated') { router.push('/auth/signin'); return; }
    const role = session?.user?.role;
    if (role && !['Intake Member', 'Admin', 'Data Lead', 'Data Member'].includes(role)) {
      router.push('/');
    }
  }, [authStatus, session, router]);

  // Load cabinets and auto-select next available slot
  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    setCabinetsLoading(true);
    fetch('/api/cabinets')
      .then(r => r.json())
      .then((data: Cabinet[]) => {
        const list = Array.isArray(data) ? data : [];
        setCabinets(list);
        const slot = findNextAvailableSlot(list);
        setNextSlot(slot);
        if (slot) {
          setForm(f => ({ ...f, cabinet: slot.cabinet._id, drawer: slot.drawer._id }));
        }
      })
      .catch(() => {})
      .finally(() => setCabinetsLoading(false));
  }, [authStatus]);

  // Load Data Lead contact for this school (shown when a duplicate is found)
  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    fetch('/api/intake/data-lead')
      .then(r => r.json())
      .then(d => setDataLead(d.lead ?? null))
      .catch(() => {});
  }, [authStatus]);

  // Load school-level intake sessions and activities
  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    fetch('/api/intake/sessions')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.sessions) && d.sessions.length) setIntakeSessions(d.sessions);
        if (Array.isArray(d.activities) && d.activities.length) setIntakeActivityOptions(d.activities);
        if (typeof d.currentFiscalYear === 'string' && d.currentFiscalYear) {
          setCurrentFiscalYear(d.currentFiscalYear);
        }
      })
      .catch(() => {});
  }, [authStatus]);

  // Fetch intake history (today or this week), optionally filtered to current user
  const fetchHistory = useCallback(async (filter: 'today' | 'week', scope: 'mine' | 'all' = 'mine') => {
    setHistoryLoading(true);
    try {
      const now = new Date();
      let since: string;
      if (filter === 'today') {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        since = d.toISOString();
      } else {
        const day = now.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
        since = monday.toISOString();
      }
      const params = new URLSearchParams({ since });
      if (scope === 'mine') params.set('createdByMe', 'true');
      const res = await fetch(`/api/students?${params.toString()}`);
      const data = await res.json();
      setHistoryStudents(Array.isArray(data) ? data : []);
    } catch {
      setHistoryStudents([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'history' && authStatus === 'authenticated') {
      fetchHistory(historyFilter, historyScope);
    }
  }, [activeTab, historyFilter, historyScope, authStatus, fetchHistory]);

  // Debounced duplicate check whenever name + DOB are sufficiently filled
  const runDuplicateCheck = useCallback(async (f: ReturnType<typeof emptyForm>) => {
    // Skip check for "Other", "Continuing Intake" and "Returning" — these use the
    // explicit existing-student search instead of the auto duplicate panel.
    if (['Other', 'Continuing Intake', 'RETURNING'].includes(f.intakeStudentStatus)) {
      setCheckResult({ status: 'idle', exact: [], fuzzy: [] });
      return;
    }
    if (!f.firstName.trim() || !f.lastName.trim() || !f.dob) {
      setCheckResult({ status: 'idle', exact: [], fuzzy: [] });
      return;
    }
    setCheckResult(r => ({ ...r, status: 'checking' }));
    try {
      const res = await fetch('/api/intake/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: f.firstName.trim(), lastName: f.lastName.trim(), dob: f.dob }),
      });
      const data = await res.json();
      const hasMatches = (data.exact?.length || 0) + (data.fuzzy?.length || 0) > 0;
      setCheckResult({
        status: hasMatches ? 'found' : 'clear',
        exact: data.exact || [],
        fuzzy: data.fuzzy || [],
      });
    } catch {
      setCheckResult({ status: 'idle', exact: [], fuzzy: [] });
    }
  }, []);

  const scheduleCheck = useCallback((f: ReturnType<typeof emptyForm>) => {
    if (checkTimeout.current) clearTimeout(checkTimeout.current);
    checkTimeout.current = setTimeout(() => runDuplicateCheck(f), 600);
  }, [runDuplicateCheck]);

  function setField(key: keyof ReturnType<typeof emptyForm>, value: string) {
    const updated = { ...form, [key]: value };
    setForm(updated);
    if (['firstName', 'lastName', 'dob'].includes(key)) {
      setSiblingAcknowledged(false);
      scheduleCheck(updated);
    }
    if (key === 'intakeStudentStatus') {
      // Reset duplicate check and selected student when type changes
      setCheckResult({ status: 'idle', exact: [], fuzzy: [] });
      setSiblingAcknowledged(false);
      setSelectedExistingStudent(null);
      setStudentSearch('');
      setStudentSearchResults([]);
    }
  }

  function toggleActivity(activity: string) {
    setForm(f => ({
      ...f,
      intakeActivity: f.intakeActivity.includes(activity)
        ? f.intakeActivity.filter(a => a !== activity)
        : [...f.intakeActivity, activity],
    }));
  }

  async function searchStudents(query: string) {
    if (!isStudentSearchQueryValid(query)) { setStudentSearchResults([]); return; }
    setStudentSearchLoading(true);
    try {
      const res = await fetch(`/api/students?search=${encodeURIComponent(query)}`);
      const data = await res.json();
      setStudentSearchResults(Array.isArray(data) ? data.slice(0, 10) : []);
    } catch { setStudentSearchResults([]); }
    finally { setStudentSearchLoading(false); }
  }

  async function doSubmit() {
    setSubmitting(true);
    setSubmitError('');
    try {
      const status = form.intakeStudentStatus;

      if (beEslAgeBlocked && beEslAgeCheck) {
        setSubmitError(beEslAgeErrorMessage(beEslAgeCheck));
        return;
      }

      // Continuing Intake & Returning (when an existing student is selected) UPDATE
      // the existing record and APPEND a new visit instead of creating a duplicate.
      const isUpdatingExisting =
        ['Continuing Intake', 'RETURNING'].includes(status) && !!selectedExistingStudent?._id;

      if (status === 'Continuing Intake' && !selectedExistingStudent?._id) {
        setSubmitError('Please search for and select the existing student before submitting a Continuing Intake.');
        return;
      }

      const timeOut = (form.isLeaving === 'Leaving') ? (form.timeOut || undefined) : undefined;

      const needsNewDrawer =
        isUpdatingExisting && studentNeedsActiveDrawer(selectedExistingStudent);

      if (needsNewDrawer && !nextSlot) {
        setSubmitError(
          'No available drawer space for this returning student. Ask your Data Lead to create an active cabinet for the new school year.',
        );
        return;
      }

      const cabinetAssignment = isUpdatingExisting && !needsNewDrawer
        ? selectedExistingStudent.cabinet
        : (needsNewDrawer ? nextSlot!.cabinet._id : (form.cabinet || undefined));

      const drawerAssignment = isUpdatingExisting && !needsNewDrawer
        ? selectedExistingStudent.drawer
        : (needsNewDrawer ? nextSlot!.drawer._id : (form.drawer || undefined));

      const payload: Record<string, any> = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        dob: form.dob,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        gender: form.gender || undefined,
        fiscalYear: currentFiscalYear,
        status: 'Active',
        startDate: (status === 'NEW') ? form.startDate : undefined,
        originalStartDate: (status !== 'NEW' && status !== 'Other') ? form.originalStartDate || undefined : undefined,
        cabinet: cabinetAssignment,
        drawer: drawerAssignment,
        reactivateFromArchive: needsNewDrawer || undefined,
        notes: form.notes.trim() || undefined,
        // New intake fields — top-level reflects the LATEST visit (for quick display)
        intakeStudentStatus: status,
        educationStatus: form.educationStatus || undefined,
        intakeActivity: form.intakeActivity.length ? form.intakeActivity : undefined,
        placementClass: form.placementClass.trim() || undefined,
        intakeSession: form.intakeSession || undefined,
        timeIn: form.timeIn || undefined,
        isLeaving: form.isLeaving || undefined,
        timeOut,
        otherNote: (status === 'Other') ? form.otherNote.trim() || undefined : undefined,
      };

      // When updating an existing record, append this visit to the time log.
      if (isUpdatingExisting && form.timeIn) {
        payload.appendVisit = {
          date: new Date().toISOString(),
          timeIn: form.timeIn,
          timeOut: timeOut || null,
          isLeaving: form.isLeaving || null,
          intakeSession: form.intakeSession || null,
          intakeActivity: form.intakeActivity,
          recordedBy: {
            name: session?.user?.name || session?.user?.email || 'Unknown',
            email: session?.user?.email || '',
          },
        };
      }

      if (siblingAcknowledged) {
        payload.siblingFlag = true;
        payload.siblingFlagNote =
          'Intake member confirmed this is a different person with the same name (possible sibling or coincidence). Requires Data Lead review.';
      }

      const res = isUpdatingExisting
        ? await fetch(`/api/students/${selectedExistingStudent._id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/students', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

      if (!res.ok) {
        const d = await res.json();
        setSubmitError(d.error || 'Failed to save student');
        return;
      }
      const student = await res.json();
      setSavedStudent(student);
    } catch {
      setSubmitError('Failed to save student. Please try again.');
    } finally {
      setSubmitting(false);
      setConfirmDupeOpen(false);
      setPendingSubmit(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Only block on duplicates for NEW students; RETURNING/CTE expect to find existing records
    const isNewStudent = form.intakeStudentStatus === 'NEW';
    if (isNewStudent && checkResult.status === 'found' && (checkResult.exact.length > 0 || checkResult.fuzzy.length > 0)) {
      setConfirmDupeOpen(true);
      setPendingSubmit(true);
      return;
    }
    doSubmit();
  }

  function resetForm() {
    // Re-compute next slot from freshly-fetched cabinets
    setCabinetsLoading(true);
    fetch('/api/cabinets')
      .then(r => r.json())
      .then((data: Cabinet[]) => {
        const list = Array.isArray(data) ? data : [];
        setCabinets(list);
        const slot = findNextAvailableSlot(list);
        setNextSlot(slot);
        const base = emptyForm();
        setForm({ ...base, cabinet: slot?.cabinet._id ?? '', drawer: slot?.drawer._id ?? '' });
      })
      .catch(() => setForm(emptyForm()))
      .finally(() => setCabinetsLoading(false));
    setCheckResult({ status: 'idle', exact: [], fuzzy: [] });
    setSiblingAcknowledged(false);
    setSavedStudent(null);
    setSubmitError('');
    setSelectedExistingStudent(null);
    setStudentSearch('');
    setStudentSearchResults([]);
  }

  if (authStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── SUCCESS / LABEL VIEW ────────────────────────────────────────────────────
  if (savedStudent) {
    // labelId = barcode on the physical label (short format: 1979-JJ-0000001)
    // studentId = demographic ID (long format: JARAMILLOJAVIERR0819790522) — not for barcode
    const barcodeValue = savedStudent.labelId || savedStudent.studentId || '';
    const qrPayload = buildStudentQrPayload({ studentId: barcodeValue });
    return (
      <div className="min-h-screen bg-green-50 dark:bg-green-950/20 flex flex-col items-center justify-center p-6 gap-6">
        <div className="flex items-center gap-3 text-green-700 dark:text-green-400">
          <CheckCircle2 className="h-8 w-8" />
          <h1 className="text-2xl font-bold">Student Registered!</h1>
        </div>

        {/* Label preview */}
        <Card className="w-full max-w-lg shadow-xl">
          <CardContent className="pt-6 pb-6 px-8 flex flex-col items-center gap-3 text-center">
            <p className="text-xl font-bold">{savedStudent.firstName} {savedStudent.lastName}</p>
            <p className="text-sm text-muted-foreground">DOB: {savedStudent.dob}</p>
            {barcodeValue && (
              <div className="w-full flex flex-row items-center justify-between gap-4 mt-2 px-2">
                <div className="flex-1 min-w-0 flex items-center justify-center overflow-hidden">
                  <Barcode value={barcodeValue} width={1.6} height={52} fontSize={12} margin={0} />
                </div>
                <QRCodeComponent
                  value={qrPayload}
                  size={200}
                  level="M"
                  containerStyle={{ width: '1in', height: '1in', flexShrink: 0 }}
                />
              </div>
            )}
            <div className="flex flex-wrap justify-center gap-2 mt-1">
              <Badge variant="outline">{savedStudent.status}</Badge>
              {savedStudent.siblingFlag && (
                <Badge variant="outline" className="text-xs border-amber-400 text-amber-700 bg-amber-50 dark:bg-amber-950/30">
                  <ShieldAlert className="h-3 w-3 mr-1" /> Sibling flag — awaiting Data Lead review
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 print:hidden">
          <Button onClick={() => window.print()} className="gap-2">
            <Printer className="h-4 w-4" /> Print Label
          </Button>
          <Button variant="outline" onClick={resetForm} className="gap-2">
            <RotateCcw className="h-4 w-4" /> New Student
          </Button>
        </div>
      </div>
    );
  }

  // ── Copy-to-clipboard message for Data Lead ─────────────────────────────────
  function buildCopyMessage(): string {
    const matches = [...checkResult.exact, ...checkResult.fuzzy];
    const now = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
    const incomingName = `${form.firstName.trim()} ${form.lastName.trim()}`;
    const dobFormatted = form.dob
      ? new Date(form.dob + 'T00:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
      : form.dob;

    const lines: string[] = [
      `⚠️  Possible Duplicate — Intake Alert`,
      `Date: ${now}`,
      ``,
      `New student being registered:`,
      `  Name: ${incomingName}`,
      `  DOB:  ${dobFormatted}`,
      ``,
      `Possible match(es) already in the system:`,
    ];

    matches.forEach((s, i) => {
      const existingDob = s.dob
        ? new Date(s.dob + 'T00:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
        : s.dob;
      lines.push(`  ${i + 1}. ${s.firstName} ${s.lastName}`);
      lines.push(`     DOB: ${existingDob}   ID: ${s.labelId || s.studentId || '—'}   Status: ${s.status || '—'}`);
      if (s._similarity) lines.push(`     Match confidence: ${s._similarity}%`);
      if (s._dobMismatch) lines.push(`     ⚠ DOB differs from new record`);
    });

    const reviewUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/admin/duplicates`
      : '/admin/duplicates';

    lines.push(``);
    if (dataLead) lines.push(`Please review and take action — contact intake if needed.`);
    lines.push(`Review page: ${reviewUrl}`);

    return lines.join('\n');
  }

  async function handleCopyMessage() {
    try {
      await navigator.clipboard.writeText(buildCopyMessage());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback: select a textarea
    }
  }

  // ── INTAKE FORM ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-40">
        <div className="w-full px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10 border border-primary/20">
              <UserPlus className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">Student Intake</h1>
              {session?.user?.school && (
                <p className="text-xs text-muted-foreground">{session.user.school}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <GoogleTranslate />
            <span className="text-sm text-muted-foreground hidden sm:inline">{session?.user?.name}</span>
            <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: '/auth/signin' })} className="gap-1.5 text-muted-foreground">
              <LogOut className="h-4 w-4" /> Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <Tabs value={activeTab} onValueChange={v => setActiveTab(v)} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 h-11">
            <TabsTrigger value="register" className="gap-2 text-sm">
              <UserPlus className="h-4 w-4" /> Register Student
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2 text-sm">
              <List className="h-4 w-4" /> Intake History
              {historyStudents.length > 0 && activeTab === 'history' && (
                <Badge className="ml-1 h-5 min-w-5 text-xs px-1.5">{historyStudents.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── REGISTER TAB ─────────────────────────────── */}
          <TabsContent value="register" className="space-y-6 mt-0">

        {/* Quick action: log a visit for a student already in the system */}
        <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-blue-300 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-950/10 px-4 py-3">
          <div className="text-sm">
            <p className="font-medium text-blue-900 dark:text-blue-200">Student already registered?</p>
            <p className="text-xs text-muted-foreground">Quickly log another visit without filling out the full form.</p>
          </div>
          <QuickAddVisit
            recordedBy={{ name: session?.user?.name || session?.user?.email || 'Unknown', email: session?.user?.email || '' }}
            onSaved={() => { if (activeTab === 'history') fetchHistory(historyFilter, historyScope); }}
          />
        </div>

        {/* Duplicate check panel */}
        {checkResult.status === 'checking' && (
          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>Checking for existing records…</AlertDescription>
          </Alert>
        )}

        {checkResult.status === 'clear' && form.intakeStudentStatus === 'NEW' && (
          <Alert className="border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertTitle className="text-green-800 dark:text-green-200">No existing records found</AlertTitle>
            <AlertDescription className="text-green-700 dark:text-green-300">
              This student does not appear to be in the system yet. Safe to register.
            </AlertDescription>
          </Alert>
        )}
        {checkResult.status === 'clear' && form.intakeStudentStatus === 'RETURNING' && (
          <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertTitle className="text-amber-800 dark:text-amber-200">No existing record found</AlertTitle>
            <AlertDescription className="text-amber-700 dark:text-amber-300">
              No matching student found. Verify the name and DOB are correct — or register as NEW if this is a first visit.
            </AlertDescription>
          </Alert>
        )}

        {checkResult.status === 'found' && (
          <div className={`rounded-lg border-2 p-4 space-y-3 transition-colors ${
            siblingAcknowledged
              ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-600'
              : 'border-destructive bg-destructive/5'
          }`}>
            {/* Header */}
            <div className="flex items-start gap-2">
              {siblingAcknowledged
                ? <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                : <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
              }
              <div>
                <p className={`font-semibold text-sm ${siblingAcknowledged ? 'text-amber-800 dark:text-amber-200' : 'text-destructive'}`}>
                  {siblingAcknowledged ? 'Flagged as different person — Data Lead will review' : 'Possible existing student(s) found'}
                </p>
                <p className={`text-xs mt-0.5 ${siblingAcknowledged ? 'text-amber-700 dark:text-amber-300' : 'text-destructive/80'}`}>
                  Review before registering to avoid duplicates:
                </p>
              </div>
            </div>

            {/* Matched records */}
            <div className="space-y-1.5">
              {[...checkResult.exact, ...checkResult.fuzzy].map((s, i) => (
                <div key={s._id || i} className="rounded-md border border-border bg-background/80 px-3 py-2 text-sm grid grid-cols-2 sm:grid-cols-4 gap-1">
                  <span><strong>Name:</strong> {s.firstName} {s.lastName}</span>
                  <span><strong>DOB:</strong> {s.dob}</span>
                  <span><strong>ID:</strong> <span className="font-mono text-xs">{s.labelId || s.studentId}</span></span>
                  <span className="flex items-center gap-1 flex-wrap">
                    <strong>Status:</strong> {s.status || '—'}
                    {s._dobMismatch && <Badge variant="outline" className="text-xs">Diff. DOB</Badge>}
                    {s._similarity && !s._dobMismatch && <Badge variant="outline" className="text-xs">{s._similarity}% match</Badge>}
                  </span>
                </div>
              ))}
            </div>

            {/* Data Lead contact + copy button */}
            <div className="rounded-md bg-muted/60 border border-border px-3 py-2.5 space-y-2">
              {dataLead && (
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 border border-primary/20 shrink-0">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Not sure? Contact your {dataLead.role}</p>
                    <p className="text-sm font-semibold text-foreground">{dataLead.name}</p>
                  </div>
                  <a
                    href={`mailto:${dataLead.email}`}
                    className="flex items-center gap-1.5 text-xs text-primary hover:underline shrink-0"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    {dataLead.email}
                  </a>
                </div>
              )}

              {/* Copy-to-clipboard for quick message to Data Lead */}
              <div className="flex items-center gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={handleCopyMessage}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border font-medium transition-all ${
                    copied
                      ? 'border-green-400 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400'
                      : 'border-border bg-background hover:bg-accent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {copied
                    ? <><Check className="h-3.5 w-3.5" /> Copied!</>
                    : <><Copy className="h-3.5 w-3.5" /> Copy alert message</>
                  }
                </button>
                <span className="text-xs text-muted-foreground">
                  Paste into email, Teams, or Slack to notify your Data Lead
                </span>
              </div>
            </div>

            {/* Sibling / coincidence acknowledgement */}
            <div className={`rounded-md border px-3 py-3 flex items-start gap-3 transition-colors ${
              siblingAcknowledged
                ? 'border-amber-400 bg-amber-100/60 dark:bg-amber-900/20'
                : 'border-border bg-muted/30'
            }`}>
              <Checkbox
                id="siblingFlag"
                checked={siblingAcknowledged}
                onCheckedChange={v => setSiblingAcknowledged(Boolean(v))}
                className="mt-0.5"
              />
              <label htmlFor="siblingFlag" className="text-sm cursor-pointer select-none">
                <span className="font-medium">This is a different person with the same name</span>
                <span className="block text-xs text-muted-foreground mt-0.5">
                  Check this if the student is a sibling, twin, or a coincidental name match.
                  The record will be flagged for your Data Lead to review.
                </span>
              </label>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* ── 1. INTAKE TYPE ──────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList className="h-4 w-4" /> Student Status
                <span className="text-destructive text-sm font-normal">*</span>
              </CardTitle>
              <CardDescription className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                *MAKE SURE TO CHECK ASISTS*
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={form.intakeStudentStatus} onValueChange={v => setField('intakeStudentStatus', v)}>
                <SelectTrigger className="font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTAKE_STATUS_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className="font-medium">{opt.label}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{opt.description}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* ── Continuing Intake / Returning: student search ────────────── */}
          {['Continuing Intake', 'RETURNING'].includes(form.intakeStudentStatus) && (
            <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2 text-blue-800 dark:text-blue-300">
                  <Users className="h-4 w-4" /> Find Existing Student
                </CardTitle>
                <CardDescription className="text-xs">
                  {form.intakeStudentStatus === 'Continuing Intake'
                    ? "Search for the student who started but didn't complete intake. This visit is added to their record."
                    : "Search for the previously-enrolled student. This visit is added to their record (no duplicate)."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Search by name, label ID, or DOB…"
                    value={studentSearch}
                    onChange={e => {
                      setStudentSearch(e.target.value);
                      searchStudents(e.target.value);
                    }}
                    className="flex-1"
                  />
                  {studentSearchLoading && <Loader2 className="h-4 w-4 animate-spin self-center text-muted-foreground" />}
                </div>
                {studentSearchResults.length > 0 && !selectedExistingStudent && (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {studentSearchResults.map(s => (
                      <button
                        key={s._id}
                        type="button"
                        onClick={() => {
                          setSelectedExistingStudent(s);
                          setStudentSearch(`${s.firstName} ${s.lastName}`);
                          setStudentSearchResults([]);
                          // Pre-fill ALL known fields from the existing record so the
                          // intake member can review and complete what's missing.
                          setForm(f => ({
                            ...f,
                            firstName: s.firstName ?? '',
                            lastName: s.lastName ?? '',
                            dob: s.dob ?? '',
                            email: s.email ?? f.email,
                            phone: s.phone ?? f.phone,
                            gender: s.gender ?? f.gender,
                            originalStartDate: s.originalStartDate || s.startDate || f.originalStartDate,
                            educationStatus: s.educationStatus ?? f.educationStatus,
                            intakeActivity: Array.isArray(s.intakeActivity) ? s.intakeActivity : f.intakeActivity,
                            placementClass: s.placementClass ?? f.placementClass,
                            intakeSession: s.intakeSession ?? f.intakeSession,
                            // Carry over the previously-entered time data
                            timeIn: s.timeIn || f.timeIn,
                            timeOut: s.timeOut ?? f.timeOut,
                            isLeaving: s.isLeaving ?? f.isLeaving,
                            notes: s.notes ?? f.notes,
                          }));
                        }}
                        className="w-full text-left rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-accent transition-colors"
                      >
                        <span className="font-medium">{s.firstName} {s.lastName}</span>
                        <span className="ml-2 text-xs text-muted-foreground">DOB: {s.dob} · ID: {s.labelId || s.studentId || '—'}</span>
                      </button>
                    ))}
                  </div>
                )}
                {selectedExistingStudent && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 rounded-md border border-green-300 bg-green-50 dark:bg-green-950/30 px-3 py-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                      <span className="flex-1 font-medium">{selectedExistingStudent.firstName} {selectedExistingStudent.lastName}</span>
                      <button type="button" onClick={() => { setSelectedExistingStudent(null); setStudentSearch(''); }} className="text-xs text-muted-foreground hover:text-foreground">Change</button>
                    </div>
                    {/* Prior visit history */}
                    {Array.isArray(selectedExistingStudent.intakeVisits) && selectedExistingStudent.intakeVisits.length > 0 && (
                      <div className="rounded-md border border-border bg-background px-3 py-2.5 text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-foreground flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            {selectedExistingStudent.intakeVisits.length} previous visit{selectedExistingStudent.intakeVisits.length !== 1 ? 's' : ''}
                          </span>
                          <Badge variant="outline" className="text-[10px]">
                            Total so far: {fmtHM(totalVisitMinutes(selectedExistingStudent.intakeVisits))}
                          </Badge>
                        </div>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {selectedExistingStudent.intakeVisits.map((v: any, i: number) => {
                            const mins = visitMinutes(v?.timeIn, v?.timeOut);
                            return (
                              <div key={i} className="flex items-center justify-between text-muted-foreground border-t border-dashed pt-1 first:border-0 first:pt-0">
                                <span>
                                  {v?.date ? new Date(v.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                                  {' · '}
                                  {v?.timeIn || '—'}{v?.timeOut ? ` → ${v.timeOut}` : ''}
                                </span>
                                <span className="font-medium">{mins != null ? fmtHM(mins) : '—'}</span>
                              </div>
                            );
                          })}
                        </div>
                        <p className="text-[10px] text-muted-foreground italic pt-0.5">
                          This new visit will be added to the history above.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── 2. PERSONAL INFORMATION ──────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4" /> Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name <span className="text-destructive">*</span></Label>
                <Input id="firstName" value={form.firstName} onChange={e => setField('firstName', e.target.value)} placeholder="First name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name <span className="text-destructive">*</span></Label>
                <Input id="lastName" value={form.lastName} onChange={e => setField('lastName', e.target.value)} placeholder="Last name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dob" className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Date of Birth <span className="text-destructive">*</span>
                </Label>
                <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                  <Input
                    id="dob"
                    type="date"
                    value={form.dob}
                    onChange={e => setField('dob', e.target.value)}
                    className="sm:max-w-[220px]"
                    required
                  />
                  {form.dob && <DateHumanHint value={form.dob} />}
                </div>
                {beEslAgeCheck && requiresBeEslAgeCheck(form) && (
                  <BeEslAgeHint check={beEslAgeCheck} />
                )}
                {!form.dob && form.intakeStudentStatus !== 'Other' && (
                  <p className="text-xs text-muted-foreground">
                    Students must be at least 21 years and 1 month old to enroll in BE (Basic Education) or ESL.
                  </p>
                )}
              </div>

              {/* Gender — NEW students only */}
              {form.intakeStudentStatus === 'NEW' && (
                <div className="space-y-2">
                  <Label>Gender <span className="text-destructive">*</span></Label>
                  <div className="flex gap-6 pt-1">
                    {['M', 'F'].map(g => (
                      <label key={g} className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="radio"
                          name="gender"
                          value={g}
                          checked={form.gender === g}
                          onChange={() => setField('gender', g)}
                          className="accent-primary"
                          required={form.intakeStudentStatus === 'NEW'}
                        />
                        <span className="text-sm font-medium">{g === 'M' ? 'Male' : 'Female'}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Start Date — NEW students only */}
              {form.intakeStudentStatus === 'NEW' && (
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date <span className="text-destructive">*</span></Label>
                  <Input id="startDate" type="date" value={form.startDate} onChange={e => setField('startDate', e.target.value)} required />
                </div>
              )}

              {/* Original Start Date — RETURNING / CTE / Continuing */}
              {['RETURNING', 'CTE Orientation', 'Continuing Intake'].includes(form.intakeStudentStatus) && (
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="originalStartDate">Original Start Date</Label>
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                    <Input
                      id="originalStartDate"
                      type="date"
                      value={form.originalStartDate}
                      onChange={e => setField('originalStartDate', e.target.value)}
                      className="sm:max-w-[220px]"
                    />
                    {form.originalStartDate && <DateHumanHint value={form.originalStartDate} />}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {form.intakeStudentStatus === 'RETURNING'
                      ? 'If returning student, check ASISTS for the start date'
                      : 'If student is continuing intake, get prev. start date from intake registration'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── 3. INTAKE DETAILS (all except Other) ─────────── */}
          {form.intakeStudentStatus !== 'Other' && (
            <>
              {/* BE or ESL */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">BE or ESL <span className="text-destructive">*</span></CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <td className="px-4 py-2 font-medium text-muted-foreground">Education Status</td>
                          <td className="px-4 py-2 text-center font-semibold">BE</td>
                          <td className="px-4 py-2 text-center font-semibold">ESL</td>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t">
                          <td className="px-4 py-3"></td>
                          {['BE', 'ESL'].map(opt => (
                            <td key={opt} className="px-4 py-3 text-center">
                              <input
                                type="radio"
                                name="educationStatus"
                                value={opt}
                                checked={form.educationStatus === opt}
                                onChange={() => setField('educationStatus', opt)}
                                className="accent-primary scale-125"
                              />
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Intake Activity */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Intake Activity <span className="text-destructive">*</span></CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {intakeActivityOptions.map(activity => (
                      <label key={activity} className="flex items-center gap-2.5 cursor-pointer select-none rounded-md border px-3 py-2.5 hover:bg-accent transition-colors">
                        <Checkbox
                          checked={form.intakeActivity.includes(activity)}
                          onCheckedChange={() => toggleActivity(activity)}
                          id={`activity-${activity}`}
                        />
                        <span className="text-sm">{activity}</span>
                      </label>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Placement Class */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Placement Class</CardTitle>
                </CardHeader>
                <CardContent>
                  <Input
                    value={form.placementClass}
                    onChange={e => setField('placementClass', e.target.value)}
                    placeholder="e.g. ESL Level 3, ABE, HSE…"
                  />
                </CardContent>
              </Card>

              {/* Intake Session */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Intake Session <span className="text-destructive">*</span></CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50">
                        <tr>
                          <td className="px-3 py-2 font-medium text-muted-foreground">Time of Day</td>
                          {intakeSessions.map(s => (
                            <td key={s} className="px-2 py-2 text-center font-semibold whitespace-nowrap">{s}</td>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t">
                          <td className="px-3 py-3"></td>
                          {intakeSessions.map(s => (
                            <td key={s} className="px-2 py-3 text-center">
                              <input
                                type="radio"
                                name="intakeSession"
                                value={s}
                                checked={form.intakeSession === s}
                                onChange={() => setField('intakeSession', s)}
                                className="accent-primary scale-125"
                              />
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Time In */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Time In <span className="text-destructive">*</span></CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={form.timeIn}
                      onChange={e => setField('timeIn', e.target.value)}
                      className="max-w-[180px]"
                    />
                    <Button type="button" variant="outline" size="sm" onClick={() => setField('timeIn', nowHHMM())} className="gap-1.5">
                      <Clock className="h-3.5 w-3.5" /> Now
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Defaults to the current time — adjust if needed.</p>
                </CardContent>
              </Card>

              {/* Leaving or Staying */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Is the student leaving the building or staying? <span className="text-destructive">*</span></CardTitle>
                  <CardDescription className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                    If the student is leaving you MUST enter a Time Out
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-6">
                    {['Leaving', 'Staying'].map(opt => (
                      <label key={opt} className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="radio"
                          name="isLeaving"
                          value={opt}
                          checked={form.isLeaving === opt}
                          onChange={() => setForm(f => ({ ...f, isLeaving: opt, timeOut: opt === 'Leaving' ? f.timeOut : '' }))}
                          className="accent-primary"
                        />
                        <span className="text-sm font-medium">{opt}</span>
                      </label>
                    ))}
                  </div>

                  {form.isLeaving === 'Leaving' && (
                    <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-3">
                      <Label htmlFor="timeOut" className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                        <Clock className="h-3.5 w-3.5" /> Time Out <span className="text-destructive">*</span>
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="timeOut"
                          type="time"
                          value={form.timeOut}
                          onChange={e => setField('timeOut', e.target.value)}
                          className="max-w-[180px] bg-background"
                          required
                        />
                        <Button type="button" variant="outline" size="sm" onClick={() => setField('timeOut', nowHHMM())} className="gap-1.5 bg-background">
                          <Clock className="h-3.5 w-3.5" /> Now
                        </Button>
                      </div>
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        You must enter a time out because the student is leaving the building.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {/* ── Other: description field ───────────────────── */}
          {form.intakeStudentStatus === 'Other' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Describe the purpose <span className="text-destructive">*</span></CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={form.otherNote}
                  onChange={e => setField('otherNote', e.target.value)}
                  rows={3}
                  placeholder="Describe why this student is here…"
                  required={form.intakeStudentStatus === 'Other'}
                />
              </CardContent>
            </Card>
          )}

          {/* ── 4. FILE ASSIGNMENT (not for Other) ──────────── */}
          {form.intakeStudentStatus !== 'Other' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FolderOpen className="h-4 w-4" /> File Assignment
                </CardTitle>
                <CardDescription className="text-xs">
                  {selectedExistingStudent && studentNeedsActiveDrawer(selectedExistingStudent)
                    ? 'Archived file — a new drawer will be assigned for the current school year.'
                    : (form.intakeStudentStatus === 'Continuing Intake' ||
                      (form.intakeStudentStatus === 'RETURNING' && selectedExistingStudent))
                      ? 'Keeps the existing file — no new space is assigned.'
                      : 'Automatically assigned to the next available drawer space.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {(form.intakeStudentStatus === 'Continuing Intake' ||
                  (form.intakeStudentStatus === 'RETURNING' && selectedExistingStudent)) ? (
                  selectedExistingStudent ? (
                    studentNeedsActiveDrawer(selectedExistingStudent) ? (
                      cabinetsLoading ? (
                        <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                          <Loader2 className="h-4 w-4 animate-spin" /> Finding next available slot…
                        </div>
                      ) : nextSlot ? (
                        <div className="rounded-lg border-2 border-dashed border-amber-300/50 bg-amber-50/40 dark:bg-amber-950/20 px-5 py-4 flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40 border border-amber-300/50 flex-shrink-0">
                            <Building2 className="h-5 w-5 text-amber-700 dark:text-amber-300" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-foreground">
                              {nextSlot.cabinet.identifier
                                ? `${nextSlot.cabinet.name} (${nextSlot.cabinet.identifier})`
                                : nextSlot.cabinet.name}
                            </div>
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                              <ChevronRight className="h-3.5 w-3.5" />
                              <span>Drawer: <strong className="text-foreground">{nextSlot.drawer.name}</strong></span>
                              {selectedExistingStudent.archiveBoxLabel && (
                                <>
                                  <span className="text-muted-foreground/60">·</span>
                                  <span>Prior file: {selectedExistingStudent.archiveBoxLabel}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs shrink-0 border-amber-400 text-amber-800 bg-amber-50">
                            New year file
                          </Badge>
                        </div>
                      ) : (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>No space available</AlertTitle>
                          <AlertDescription>All cabinets are full. Contact your Data Lead to create new cabinet space.</AlertDescription>
                        </Alert>
                      )
                    ) : (
                    (() => {
                      const cab = cabinets.find(c => c._id === selectedExistingStudent.cabinet);
                      const drw = cab?.drawers.find(d => d._id === selectedExistingStudent.drawer);
                      return (
                        <div className="rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/30 px-5 py-4 flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 flex-shrink-0">
                            <Building2 className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-foreground">
                              {cab
                                ? (cab.identifier ? `${cab.name} (${cab.identifier})` : cab.name)
                                : 'Existing file location'}
                            </div>
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                              <ChevronRight className="h-3.5 w-3.5" />
                              <span>Drawer: <strong className="text-foreground">{drw?.name ?? selectedExistingStudent.drawer ?? '—'}</strong></span>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs shrink-0">
                            Existing file
                          </Badge>
                        </div>
                      );
                    })()
                    )
                  ) : (
                    <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                      <AlertCircle className="h-4 w-4" /> Select the existing student above to keep their current file.
                    </div>
                  )
                ) : cabinetsLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Finding next available slot…
                  </div>
                ) : nextSlot ? (
                  <div className="rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/30 px-5 py-4 flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 flex-shrink-0">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-foreground">
                        {nextSlot.cabinet.identifier
                          ? `${nextSlot.cabinet.name} (${nextSlot.cabinet.identifier})`
                          : nextSlot.cabinet.name}
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                        <ChevronRight className="h-3.5 w-3.5" />
                        <span>Drawer: <strong className="text-foreground">{nextSlot.drawer.name}</strong></span>
                        <span className="text-muted-foreground/60">·</span>
                        <span>{nextSlot.spacesLeft} space{nextSlot.spacesLeft !== 1 ? 's' : ''} remaining</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0 border-green-300 text-green-700 bg-green-50 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800">
                      Auto-assigned
                    </Badge>
                  </div>
                ) : (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No space available</AlertTitle>
                    <AlertDescription>All cabinets are full. Contact your Data Lead to create new cabinet space.</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── 5. NOTES ──────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={form.notes}
                onChange={e => setField('notes', e.target.value)}
                rows={2}
                placeholder="Any additional notes about this visit (optional)"
              />
            </CardContent>
          </Card>

          {submitError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-3 pb-8">
            <Button type="button" variant="outline" onClick={resetForm} disabled={submitting || cabinetsLoading}>
              <RotateCcw className="mr-2 h-4 w-4" /> Clear
            </Button>
            <Button
              type="submit"
              disabled={
                submitting ||
                cabinetsLoading ||
                beEslAgeBlocked ||
                // Continuing Intake requires an existing record to be selected
                (form.intakeStudentStatus === 'Continuing Intake' && !selectedExistingStudent) ||
                // A free slot is only needed when creating a brand-new file:
                // not for Other, and not when updating an existing Continuing/Returning record
                (form.intakeStudentStatus !== 'Other' &&
                  !(['Continuing Intake', 'RETURNING'].includes(form.intakeStudentStatus) && selectedExistingStudent) &&
                  !nextSlot)
              }
              size="lg"
              className="gap-2 min-w-[160px]"
            >
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
              ) : (
                <><UserPlus className="h-4 w-4" /> Register & Print Label</>
              )}
            </Button>
          </div>
        </form>
          </TabsContent>

          {/* ── HISTORY TAB ──────────────────────────────── */}
          <TabsContent value="history" className="mt-0">
            <HistoryPanel
              students={historyStudents}
              loading={historyLoading}
              filter={historyFilter}
              onFilterChange={f => setHistoryFilter(f)}
              scope={historyScope}
              onScopeChange={s => setHistoryScope(s)}
              currentUserEmail={session?.user?.email ?? ''}
              canViewAll={['Admin', 'Data Lead'].includes((session?.user as any)?.role ?? '')}
              onRefresh={() => fetchHistory(historyFilter, historyScope)}
            />
          </TabsContent>
        </Tabs>
      </main>

      {/* Duplicate confirmation dialog */}
      <Dialog open={confirmDupeOpen} onOpenChange={setConfirmDupeOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertCircle className="h-5 w-5" />
              {siblingAcknowledged ? 'Register as New Student (Flagged)' : 'Possible Duplicate Detected'}
            </DialogTitle>
            <DialogDescription>
              {siblingAcknowledged
                ? 'You confirmed this is a different person. The record will be flagged as a possible sibling or name coincidence for your Data Lead to review.'
                : 'We found student(s) in the system that may match this person. Are you sure you want to register a new record?'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-52 overflow-y-auto">
            {[...checkResult.exact, ...checkResult.fuzzy].map((s, i) => (
              <div key={s._id || i} className="rounded-md border px-3 py-2 text-sm grid grid-cols-2 gap-1 bg-muted/40">
                <span><strong>Name:</strong> {s.firstName} {s.lastName}</span>
                <span><strong>DOB:</strong> {s.dob}</span>
                <span><strong>ID:</strong> <span className="font-mono text-xs">{s.studentId}</span></span>
                <span><strong>Status:</strong> {s.status || '—'}</span>
              </div>
            ))}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setConfirmDupeOpen(false); setPendingSubmit(false); }}>
              Cancel — Go Back
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              disabled={submitting}
              onClick={doSubmit}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Yes, Register as New Student
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Reprint a single history row label ──────────────────────────────────────

function ReprintHistoryLabel({ student }: { student: any }) {
  const [open, setOpen] = useState(false);
  const barcodeValue = student.labelId || student.studentId || '';
  const qrPayload = buildStudentQrPayload({ studentId: barcodeValue });
  return (
    <>
      <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground shrink-0"
        onClick={() => setOpen(true)} title="Reprint label">
        <Printer className="h-4 w-4" />
        <span className="hidden sm:inline">Reprint</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Reprint Label</DialogTitle>
            <DialogDescription>{student.firstName} {student.lastName}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-2 py-2">
            <p className="text-sm font-semibold">{student.firstName} {student.lastName}</p>
            <p className="text-xs text-muted-foreground">DOB: {student.dob}</p>
            {barcodeValue && (
              <div className="w-full flex flex-row items-center justify-center gap-2">
                <Barcode value={barcodeValue} width={1.6} height={32} fontSize={9} margin={0} />
                <QRCodeComponent value={qrPayload} size={200} level="M" containerStyle={{ width: '0.75in', height: '0.75in', flexShrink: 0 }} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => window.print()} className="gap-2 w-full">
              <Printer className="h-4 w-4" /> Print
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Add-Visit button (log another time for a returning student) ──────────────
function AddVisitButton({ student, onSaved }: { student: any; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [timeIn, setTimeIn] = useState(nowHHMM());
  const [leaving, setLeaving] = useState<'Leaving' | 'Staying' | ''>('');
  const [timeOut, setTimeOut] = useState('');
  const [activity, setActivity] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const priorVisits: any[] = Array.isArray(student.intakeVisits) ? student.intakeVisits : [];
  const priorTotal = totalVisitMinutes(priorVisits);

  function reset() {
    setTimeIn(nowHHMM()); setLeaving(''); setTimeOut(''); setActivity(''); setError('');
  }

  async function save() {
    if (!timeIn) { setError('Please enter a time in.'); return; }
    if (leaving === 'Leaving' && !timeOut) { setError('Please enter a time out — the student is leaving.'); return; }
    setSaving(true);
    setError('');
    try {
      const out = leaving === 'Leaving' ? timeOut : undefined;
      const res = await fetch(`/api/students/${student._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Top-level reflects the latest visit
          timeIn,
          timeOut: out ?? null,
          isLeaving: leaving || null,
          appendVisit: {
            date: new Date().toISOString(),
            timeIn,
            timeOut: out ?? null,
            isLeaving: leaving || null,
            intakeActivity: activity ? [activity] : [],
          },
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || 'Failed to add visit.');
        return;
      }
      setOpen(false);
      reset();
      onSaved();
    } catch {
      setError('Failed to add visit. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button
        variant="ghost" size="sm"
        className="gap-1.5 text-muted-foreground hover:text-foreground shrink-0"
        onClick={() => { reset(); setOpen(true); }}
        title="Log another visit"
      >
        <Clock className="h-4 w-4" />
        <span className="hidden sm:inline">Add Visit</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Log Another Visit</DialogTitle>
            <DialogDescription>{student.firstName} {student.lastName} · DOB {student.dob}</DialogDescription>
          </DialogHeader>

          {priorVisits.length > 0 && (
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs flex items-center justify-between">
              <span>{priorVisits.length} previous visit{priorVisits.length !== 1 ? 's' : ''}</span>
              <Badge variant="outline" className="text-[10px]">Total so far: {fmtHM(priorTotal)}</Badge>
            </div>
          )}

          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Time In</Label>
              <div className="flex items-center gap-2">
                <Input type="time" value={timeIn} onChange={e => setTimeIn(e.target.value)} className="max-w-[160px]" />
                <Button type="button" variant="outline" size="sm" onClick={() => setTimeIn(nowHHMM())} className="gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Now
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Leaving or staying?</Label>
              <div className="flex gap-4">
                {(['Leaving', 'Staying'] as const).map(opt => (
                  <label key={opt} className="flex items-center gap-2 cursor-pointer select-none text-sm">
                    <input
                      type="radio" name="addVisitLeaving" value={opt}
                      checked={leaving === opt}
                      onChange={() => { setLeaving(opt); if (opt === 'Staying') setTimeOut(''); }}
                      className="accent-primary"
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </div>

            {leaving === 'Leaving' && (
              <div className="space-y-1.5 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-3 py-2.5">
                <Label className="text-xs text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Time Out
                </Label>
                <div className="flex items-center gap-2">
                  <Input type="time" value={timeOut} onChange={e => setTimeOut(e.target.value)} className="max-w-[160px] bg-background" />
                  <Button type="button" variant="outline" size="sm" onClick={() => setTimeOut(nowHHMM())} className="gap-1.5 bg-background">
                    <Clock className="h-3.5 w-3.5" /> Now
                  </Button>
                </div>
                {timeIn && timeOut && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400">
                    This visit: {fmtHM(visitMinutes(timeIn, timeOut) ?? 0)}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Activity / reason (optional)</Label>
              <Input value={activity} onChange={e => setActivity(e.target.value)} placeholder="e.g. Testing, Orientation…" />
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="gap-2">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <><Clock className="h-4 w-4" /> Add Visit</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Quick Add-Visit (from the Register tab): search a student, then log time ──
function QuickAddVisit({ recordedBy, onSaved }: { recordedBy: { name: string; email: string }; onSaved?: () => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<any>(null);

  const [timeIn, setTimeIn] = useState(nowHHMM());
  const [leaving, setLeaving] = useState<'Leaving' | 'Staying' | ''>('');
  const [timeOut, setTimeOut] = useState('');
  const [activity, setActivity] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedName, setSavedName] = useState('');

  const debounce = useRef<NodeJS.Timeout | null>(null);

  function resetAll() {
    setQuery(''); setResults([]); setSelected(null);
    setTimeIn(nowHHMM()); setLeaving(''); setTimeOut(''); setActivity('');
    setError(''); setSavedName('');
  }

  function runSearch(q: string) {
    setQuery(q);
    if (debounce.current) clearTimeout(debounce.current);
    if (!isStudentSearchQueryValid(q)) { setResults([]); return; }
    debounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/students?search=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults(Array.isArray(data) ? data.slice(0, 10) : []);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 400);
  }

  const priorVisits: any[] = Array.isArray(selected?.intakeVisits) ? selected.intakeVisits : [];

  async function save() {
    if (!selected?._id) { setError('Select a student first.'); return; }
    if (!timeIn) { setError('Please enter a time in.'); return; }
    if (leaving === 'Leaving' && !timeOut) { setError('Please enter a time out — the student is leaving.'); return; }
    setSaving(true);
    setError('');
    try {
      const out = leaving === 'Leaving' ? timeOut : undefined;
      const res = await fetch(`/api/students/${selected._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timeIn,
          timeOut: out ?? null,
          isLeaving: leaving || null,
          appendVisit: {
            date: new Date().toISOString(),
            timeIn,
            timeOut: out ?? null,
            isLeaving: leaving || null,
            intakeActivity: activity ? [activity] : [],
            recordedBy,
          },
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || 'Failed to add visit.');
        return;
      }
      setSavedName(`${selected.firstName} ${selected.lastName}`);
      // Reset for the next quick entry but stay open to confirm
      setSelected(null); setQuery(''); setResults([]);
      setTimeIn(nowHHMM()); setLeaving(''); setTimeOut(''); setActivity('');
      onSaved?.();
    } catch {
      setError('Failed to add visit. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button
        type="button" variant="outline"
        className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950/30"
        onClick={() => { resetAll(); setOpen(true); }}
      >
        <Clock className="h-4 w-4" /> Add a visit (returning student)
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add a Visit</DialogTitle>
            <DialogDescription>Log time for a student who is already in the system.</DialogDescription>
          </DialogHeader>

          {savedName && (
            <div className="rounded-md border border-green-300 bg-green-50 dark:bg-green-950/30 px-3 py-2 text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
              <span>Visit added for <strong>{savedName}</strong>. Add another below or close.</span>
            </div>
          )}

          {/* Search */}
          {!selected && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Search by name, label ID, or DOB…"
                  value={query}
                  onChange={e => runSearch(e.target.value)}
                  autoFocus
                />
                {searching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
              {results.length > 0 && (
                <div className="space-y-1.5 max-h-44 overflow-y-auto">
                  {results.map(s => (
                    <button
                      key={s._id}
                      type="button"
                      onClick={() => { setSelected(s); setResults([]); setSavedName(''); }}
                      className="w-full text-left rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-accent transition-colors"
                    >
                      <span className="font-medium">{s.firstName} {s.lastName}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        DOB: {s.dob}
                        {Array.isArray(s.intakeVisits) && s.intakeVisits.length ? ` · ${s.intakeVisits.length} visit(s)` : ''}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Selected + time entry */}
          {selected && (
            <div className="space-y-3 py-1">
              <div className="flex items-center gap-2 rounded-md border border-green-300 bg-green-50 dark:bg-green-950/30 px-3 py-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                <span className="flex-1 font-medium">{selected.firstName} {selected.lastName}</span>
                {priorVisits.length > 0 && (
                  <Badge variant="outline" className="text-[10px]">{priorVisits.length} visit(s) · {fmtHM(totalVisitMinutes(priorVisits))}</Badge>
                )}
                <button type="button" onClick={() => setSelected(null)} className="text-xs text-muted-foreground hover:text-foreground">Change</button>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Time In</Label>
                <div className="flex items-center gap-2">
                  <Input type="time" value={timeIn} onChange={e => setTimeIn(e.target.value)} className="max-w-[160px]" />
                  <Button type="button" variant="outline" size="sm" onClick={() => setTimeIn(nowHHMM())} className="gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> Now
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Leaving or staying?</Label>
                <div className="flex gap-4">
                  {(['Leaving', 'Staying'] as const).map(opt => (
                    <label key={opt} className="flex items-center gap-2 cursor-pointer select-none text-sm">
                      <input
                        type="radio" name="quickVisitLeaving" value={opt}
                        checked={leaving === opt}
                        onChange={() => { setLeaving(opt); if (opt === 'Staying') setTimeOut(''); }}
                        className="accent-primary"
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>

              {leaving === 'Leaving' && (
                <div className="space-y-1.5 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-3 py-2.5">
                  <Label className="text-xs text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> Time Out
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input type="time" value={timeOut} onChange={e => setTimeOut(e.target.value)} className="max-w-[160px] bg-background" />
                    <Button type="button" variant="outline" size="sm" onClick={() => setTimeOut(nowHHMM())} className="gap-1.5 bg-background">
                      <Clock className="h-3.5 w-3.5" /> Now
                    </Button>
                  </div>
                  {timeIn && timeOut && (
                    <p className="text-[11px] text-amber-700 dark:text-amber-400">This visit: {fmtHM(visitMinutes(timeIn, timeOut) ?? 0)}</p>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs">Activity / reason (optional)</Label>
                <Input value={activity} onChange={e => setActivity(e.target.value)} placeholder="e.g. Testing, Orientation…" />
              </div>
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Close</Button>
            <Button onClick={save} disabled={saving || !selected} className="gap-2">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <><Clock className="h-4 w-4" /> Add Visit</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── History Panel ────────────────────────────────────────────────────────────

function DateHumanHint({ value }: { value: string }) {
  const label = formatHumanDate(value);
  if (!label) return null;
  return <p className="text-sm font-medium text-foreground">{label}</p>;
}

function BeEslAgeHint({ check }: { check: ReturnType<typeof checkBeEslAgeEligibility> }) {
  const message = beEslAgeHintMessage(check);
  return (
    <p
      className={
        check.eligible
          ? 'text-xs text-green-700 dark:text-green-400'
          : 'text-xs font-medium text-amber-700 dark:text-amber-400'
      }
    >
      {message}
    </p>
  );
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

function groupByDay(students: any[]) {
  const groups = new Map<string, any[]>();
  for (const s of students) {
    const label = s.createdAt ? dayLabel(s.createdAt) : 'Unknown date';
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(s);
  }
  return groups;
}

interface HistoryPanelProps {
  students: any[];
  loading: boolean;
  filter: 'today' | 'week';
  onFilterChange: (f: 'today' | 'week') => void;
  scope: 'mine' | 'all';
  onScopeChange: (s: 'mine' | 'all') => void;
  currentUserEmail: string;
  canViewAll: boolean;
  onRefresh: () => void;
}

function HistoryPanel({
  students, loading, filter, onFilterChange,
  scope, onScopeChange, currentUserEmail, canViewAll,
  onRefresh,
}: HistoryPanelProps) {
  const todayCount = students.filter(s => s.createdAt && dayLabel(s.createdAt) === 'Today').length;
  const weekCount = students.length;
  const groups = groupByDay(students);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Time filter */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onFilterChange('today')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                filter === 'today'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border text-muted-foreground hover:border-primary/50'
              }`}
            >
              <Clock className="h-3.5 w-3.5" /> Today
              <span className={`ml-1 text-xs rounded-full px-1.5 py-0.5 ${filter === 'today' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {todayCount}
              </span>
            </button>
            <button
              onClick={() => onFilterChange('week')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                filter === 'week'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border text-muted-foreground hover:border-primary/50'
              }`}
            >
              <CalendarDays className="h-3.5 w-3.5" /> This Week
              <span className={`ml-1 text-xs rounded-full px-1.5 py-0.5 ${filter === 'week' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {weekCount}
              </span>
            </button>
          </div>

          {/* Scope filter — only Data Leads / Admins see the toggle */}
          {canViewAll && (
            <div className="flex items-center gap-1 rounded-full border border-border bg-muted/40 p-0.5">
              <button
                onClick={() => onScopeChange('mine')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  scope === 'mine'
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <User className="h-3 w-3" /> My registrations
              </button>
              <button
                onClick={() => onScopeChange('all')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  scope === 'all'
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Users className="h-3 w-3" /> All staff
              </button>
            </div>
          )}
        </div>

        <Button variant="ghost" size="sm" onClick={onRefresh} disabled={loading} className="gap-1.5 text-muted-foreground">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading…
        </div>
      )}

      {!loading && students.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-3">
          <CalendarDays className="h-10 w-10 opacity-30" />
          <p className="text-sm">
            No students registered {filter === 'today' ? 'today' : 'this week'}
            {scope === 'mine' ? ' by you' : ''} yet.
          </p>
        </div>
      )}

      {!loading && groups.size > 0 && (
        <div className="space-y-5">
          {[...groups.entries()].map(([day, rows]) => (
            <div key={day}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{day}</span>
                <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">{rows.length}</span>
              </div>
              <div className="rounded-lg border overflow-hidden divide-y">
                {rows.map((s, i) => {
                  const isMe = s.createdBy?.email === currentUserEmail;
                  return (
                    <div key={s._id || i} className="flex items-center gap-3 px-4 py-3 bg-background hover:bg-muted/30 transition-colors">
                      {/* Avatar initial */}
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm flex-shrink-0">
                        {(s.firstName?.[0] ?? '?').toUpperCase()}
                      </div>
                      {/* Name + details */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {s.firstName} {s.lastName}
                        </div>
                        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                          <span>DOB: {s.dob}</span>
                          {s.createdAt && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />{formatTime(s.createdAt)}
                            </span>
                          )}
                          {s.program && <span>{s.program}</span>}
                          {/* Registrant — shown in "All staff" scope or when not the current user */}
                          {s.createdBy?.name && (scope === 'all' || !isMe) && (
                            <span className={`flex items-center gap-1 ${isMe ? 'text-primary font-medium' : ''}`}>
                              <User className="h-3 w-3" />
                              {isMe ? 'You' : s.createdBy.name}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Cabinet info */}
                      {s.cabinetName && (
                        <div className="hidden sm:flex flex-col items-end text-xs text-muted-foreground">
                          <span className="font-medium text-foreground text-right truncate max-w-[120px]">{s.cabinetName}</span>
                          {s.drawerName && <span>{s.drawerName}</span>}
                        </div>
                      )}
                      {/* Status badge */}
                      <Badge variant="outline" className="text-xs shrink-0 hidden sm:inline-flex">
                        {s.status || 'Active'}
                      </Badge>
                      {/* Add another visit */}
                      <AddVisitButton student={s} onSaved={onRefresh} />
                      {/* Reprint */}
                      <ReprintHistoryLabel student={s} />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
