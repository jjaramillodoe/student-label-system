'use client';

import { useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import GoogleTranslate from '@/components/GoogleTranslate';
import Avery5163LabelContent from '@/components/Avery5163LabelContent';
import Avery94205LabelContent from '@/components/Avery94205LabelContent';
import AveryPrintGuidance from '@/components/AveryPrintGuidance';
import { isStudentSearchQueryValid } from '@/lib/studentSearch';
import { sanitizeUsaNameInput, usaNameError, USA_NAME_HINT } from '@/lib/usaName';
import { DEFAULT_INTAKE_ACTIVITIES, DEFAULT_INTAKE_SESSION_CONFIGS } from '@/lib/intakeDefaults';
import {
  findIntakeSession,
  formatSessionTimeRange,
  formatTime12,
  getIntakeSessionTimeFieldErrors,
  validateIntakeSessionTimes,
  type IntakeSession,
} from '@/lib/intakeSession';
import { getStudentStorageDisplay } from '@/lib/studentLocation';
import { findNextAvailableSlot, returningStudentNeedsNewDrawer, studentHasArchiveBoxLocation, studentIsArchived, type NextCabinetSlot } from '@/lib/cabinets';
import { cn, formatHumanDate, normalizeMongoId } from '@/lib/utils';
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
  UserPlus, AlertCircle, CheckCircle2, RotateCcw, FileText,
  Loader2, User, Calendar, Phone, Mail, ClipboardList, LogOut, Building2,
  FolderOpen, ChevronRight, List, RefreshCw, Clock, CalendarDays,
  Users, ShieldAlert, Copy, Check, MapPin, ExternalLink, Lock, ChevronDown, BookOpen,
  Boxes, QrCode, Archive,
} from 'lucide-react';
import QRCode from '@/components/QRCode';
import IntakeIssuesBanner from '@/components/IntakeIssuesBanner';
import IntakeHandoffFixDialog from '@/components/IntakeHandoffFixDialog';
import IntakeAddressFields, {
  type IntakeAddressVerification,
  type IntakeAddressValues,
} from '@/components/IntakeAddressFields';
import IntakeMatchCard, { type IntakeMatchStudent } from '@/components/IntakeMatchCard';
import { formatStudentAddressStacked } from '@/lib/addressValidation';
import { googleMapsSearchUrl } from '@/lib/googleMaps';
import { epeVisitsTotalMinutes } from '@/lib/epeClock';
import {
  addressMatchHint,
  addressMatchLabel,
  type AddressMatchKind,
} from '@/lib/addressDuplicate';

const INTAKE_STATUS_OPTIONS = [
  { value: 'NEW',             label: 'NEW',       description: 'First-time student' },
  { value: 'RETURNING',       label: 'RETURNING', description: 'Returning or continuing intake — log another visit' },
  { value: 'CTE Orientation', label: 'CTE Orientation', description: 'Career & Technical Education orientation' },
  { value: 'Other',           label: 'Other',     description: 'Other purpose — describe below' },
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

// Total minutes across visit log (per-day span: first time-in → final clock-out).
function totalVisitMinutes(visits: any[] | undefined): number {
  if (!Array.isArray(visits)) return 0;
  return epeVisitsTotalMinutes(visits) ?? 0;
}

// Format minutes as "1h 25m".
function fmtHM(mins: number): string {
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Fresh visit fields when logging a returning student (do not copy prior visit). */
function emptyReturningVisitFields() {
  return {
    educationStatus: '',
    intakeActivity: [] as string[],
    placementClass: '',
    intakeSession: '',
    timeIn: nowHHMM(),
    timeOut: '',
    isLeaving: '',
    notes: '',
  };
}

function IntakeMemberGuide() {
  const GUIDE_SEEN_KEY = 'intake-member-guide-seen';
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(GUIDE_SEEN_KEY) !== '1') {
        setOpen(true);
      }
    } catch {
      setOpen(true);
    }
  }, []);

  function toggleOpen() {
    setOpen(prev => {
      const next = !prev;
      if (!next) {
        try {
          localStorage.setItem(GUIDE_SEEN_KEY, '1');
        } catch {
          // ignore storage failures
        }
      }
      return next;
    });
  }

  return (
    <Card className="border-primary/20 bg-primary/[0.02]">
      <CardHeader className="pb-3">
        <button
          type="button"
          onClick={toggleOpen}
          className="w-full flex items-start gap-3 text-left"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
            <BookOpen className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base flex items-center gap-2">
              Intake member guide
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Step-by-step: how to register new students, log returning visits, and what to check before you submit.
            </CardDescription>
          </div>
        </button>
      </CardHeader>
      {open && (
        <CardContent className="pt-0 space-y-5 text-sm">
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-2.5">
              <p className="font-semibold text-foreground flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-primary" />
                New First Time Student
              </p>
              <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground text-xs leading-relaxed">
                <li>Start with <strong className="text-foreground">Check school records</strong> (name, DOB, or Label ID) — this includes archived files.</li>
                <li>Select <strong className="text-foreground">New First Time Student</strong> under Student Status only if no match.</li>
                <li>Enter <strong className="text-foreground">first name, last name, and date of birth</strong>. Names use <strong className="text-foreground">A–Z letters, spaces, and hyphens only</strong> — no accents or special characters. Watch the duplicate alert — it checks automatically, including archived records.</li>
                <li>Add <strong className="text-foreground">phone, email, and home address</strong>. Click <strong className="text-foreground">Verify with NYC Geoclient</strong> so the standardized address is saved.</li>
                <li>If a <strong className="text-foreground">possible duplicate</strong> appears, compare name, DOB, and address. If it is the same person, click <strong className="text-foreground">Same person — log returning</strong> (even if Archived).</li>
                <li>Only check <strong className="text-foreground">“This is a different person”</strong> for a true sibling or coincidence — that flags the record for Data Lead review.</li>
                <li>Complete <strong className="text-foreground">BE or ESL</strong>, intake activity, placement class, session, and <strong className="text-foreground">Time In</strong> (defaults to now).</li>
                <li>Choose <strong className="text-foreground">Staying</strong> if another staff member will continue intake, or <strong className="text-foreground">Leaving</strong> with Time Out when the student is done for the day.</li>
                <li>Click <strong className="text-foreground">Register Student</strong> and review the success summary. Labels are printed later from the Dashboard via <strong className="text-foreground">Download Word Doc</strong> (Letter, 100%).</li>
              </ol>
            </div>
            <div className="space-y-2.5">
              <p className="font-semibold text-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Returning Student (another visit)
              </p>
              <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground text-xs leading-relaxed">
                <li>Select <strong className="text-foreground">RETURNING</strong> under Student Status.</li>
                <li>Search by name, label ID, or DOB and select the student. Prior visits appear in the accordion — expand to review history.</li>
                <li>Personal info and address are <strong className="text-foreground">locked</strong> from the student record. Complete <strong className="text-foreground">today&apos;s visit</strong> fields fresh (BE/ESL, activity, session, time).</li>
                <li>File assignment keeps the existing cabinet/drawer unless the student needs a new drawer for the school year.</li>
                <li>Click <strong className="text-foreground">Log Visit &amp; Save</strong> — this adds a new visit without overwriting past visits.</li>
              </ol>
            </div>
          </div>
          <div className="rounded-md border border-amber-200/80 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800/60 px-3 py-3 space-y-2">
            <p className="font-semibold text-xs text-amber-900 dark:text-amber-100 flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" />
              Before you submit — quick checklist
            </p>
            <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-amber-800/90 dark:text-amber-200/90">
              <li>✓ Duplicate alert reviewed (name + DOB + address)</li>
              <li>✓ BE/ESL age rule met (21 years old for BE/ESL)</li>
              <li>✓ Address verified with Geoclient (new students)</li>
              <li>✓ Time In correct; Time Out if student is leaving</li>
              <li>✓ Handoff visits marked <strong>Staying</strong> — only final staff clocks out</li>
              <li>✓ Placement class and intake activity completed</li>
            </ul>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Use <strong className="text-foreground">Reset</strong> to clear the form, or the <strong className="text-foreground">Intake History</strong> tab to review today&apos;s registrations. Contact your Data Lead for duplicates, address corrections, or cabinet issues.
          </p>
        </CardContent>
      )}
    </Card>
  );
}

function addressMatchBadgeClass(match?: AddressMatchKind): string {
  switch (match) {
    case 'same_verified':
      return 'bg-green-100 text-green-800 border-green-300';
    case 'same':
    case 'similar':
      return 'bg-emerald-50 text-emerald-800 border-emerald-300';
    case 'different':
      return 'bg-sky-50 text-sky-800 border-sky-300';
    case 'incoming_missing':
      return 'bg-amber-50 text-amber-800 border-amber-300';
    default:
      return 'bg-slate-50 text-slate-600 border-slate-300';
  }
}

function ReturningVisitHistory({ visits }: { visits: any[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const sorted = [...visits].sort(
    (a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime(),
  );

  return (
    <div className="rounded-md border border-border bg-background px-3 py-2.5 text-xs space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-medium text-foreground flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          {sorted.length} previous visit{sorted.length !== 1 ? 's' : ''}
        </span>
        <Badge variant="outline" className="text-[10px]">
          Total so far: {fmtHM(totalVisitMinutes(sorted))}
        </Badge>
      </div>
      <div className="space-y-1">
        {sorted.map((v, i) => {
          const isOpen = openIdx === i;
          const mins = visitMinutes(v?.timeIn, v?.timeOut);
          const dateLabel = v?.date
            ? new Date(v.date).toLocaleString('en-US', {
                month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
              })
            : '—';
          const summary = [
            v?.educationStatus,
            v?.intakeActivity?.length ? v.intakeActivity.join(', ') : null,
          ].filter(Boolean).join(' · ') || 'Visit recorded';

          return (
            <div key={`${v.date}-${i}`} className="rounded-md border border-border/80 overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenIdx(isOpen ? null : i)}
                className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-muted/40 transition-colors"
              >
                <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                <span className="flex-1 min-w-0">
                  <span className="font-medium text-foreground">Visit {i + 1}</span>
                  <span className="text-muted-foreground"> · {dateLabel}</span>
                  <span className="block text-[10px] text-muted-foreground truncate">{summary}</span>
                </span>
                <span className="shrink-0 font-medium text-foreground">
                  {v?.isLeaving === 'Staying' ? 'Staying' : (mins != null ? fmtHM(mins) : '—')}
                </span>
              </button>
              {isOpen && (
                <div className="px-3 pb-2.5 pt-0 space-y-1.5 border-t border-dashed text-muted-foreground">
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-2">
                    <p><span className="text-foreground/70">Time in:</span> {v?.timeIn || '—'}</p>
                    <p>
                      <span className="text-foreground/70">Time out:</span>{' '}
                      {v?.isLeaving === 'Staying' ? 'Staying' : (v?.timeOut || '—')}
                    </p>
                    <p><span className="text-foreground/70">BE / ESL:</span> {v?.educationStatus || '—'}</p>
                    <p><span className="text-foreground/70">Session:</span> {v?.intakeSession || '—'}</p>
                    <p className="col-span-2">
                      <span className="text-foreground/70">Activity:</span>{' '}
                      {v?.intakeActivity?.length ? v.intakeActivity.join(', ') : '—'}
                    </p>
                    {v?.placementClass && (
                      <p className="col-span-2">
                        <span className="text-foreground/70">Placement:</span> {v.placementClass}
                      </p>
                    )}
                    {v?.notes && (
                      <p className="col-span-2">
                        <span className="text-foreground/70">Notes:</span> {v.notes}
                      </p>
                    )}
                    <p className="col-span-2 text-[10px] italic">
                      Recorded by {v?.recordedBy?.name || v?.recordedBy?.email || '—'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground italic">
        Complete today&apos;s visit below — each submission adds a new entry here.
      </p>
    </div>
  );
}

const emptyForm = () => ({
  // Identity
  firstName: '',
  lastName: '',
  dob: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  state: 'NY',
  zip: '',
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
  const [p2gCopied, setP2gCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [savedStudent, setSavedStudent] = useState<any>(null);
  const [savedAsVisit, setSavedAsVisit] = useState(false);
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
  const [geoclientConfigured, setGeoclientConfigured] = useState<boolean | null>(null);
  const [addressVerification, setAddressVerification] = useState<IntakeAddressVerification | null>(null);
  const [intakeAddress, setIntakeAddress] = useState<IntakeAddressValues>({
    address: '', apt: '', city: '', state: 'NY', zip: '',
  });

  // Intake sessions, activities, and fiscal year (school-level config)
  const [intakeSessions, setIntakeSessions] = useState<IntakeSession[]>(DEFAULT_INTAKE_SESSION_CONFIGS);
  const [intakeActivityOptions, setIntakeActivityOptions] = useState<string[]>(DEFAULT_INTAKE_ACTIVITIES);
  const [currentFiscalYear, setCurrentFiscalYear] = useState('2025-2026');

  // Returning student search
  const [studentSearch, setStudentSearch] = useState('');
  const [studentSearchResults, setStudentSearchResults] = useState<any[]>([]);
  const [studentSearchLoading, setStudentSearchLoading] = useState(false);
  const [selectedExistingStudent, setSelectedExistingStudent] = useState<any>(null);
  const [issuesRefresh, setIssuesRefresh] = useState(0);
  const [fixTarget, setFixTarget] = useState<{ id: string; name: string } | null>(null);

  // Always-on school roster lookup (includes archived)
  const [schoolLookup, setSchoolLookup] = useState('');
  const [schoolLookupResults, setSchoolLookupResults] = useState<any[]>([]);
  const [schoolLookupLoading, setSchoolLookupLoading] = useState(false);
  const [schoolLookupDone, setSchoolLookupDone] = useState(false);

  const checkTimeout = useRef<NodeJS.Timeout | null>(null);
  const schoolLookupTimeout = useRef<NodeJS.Timeout | null>(null);

  const beEslAgeCheck = useMemo(
    () => (form.dob ? checkBeEslAgeEligibility(form.dob) : null),
    [form.dob],
  );
  const beEslAgeBlocked = Boolean(
    beEslAgeCheck
    && requiresBeEslAgeCheck(form)
    && !beEslAgeCheck.eligible,
  );

  const sessionTimeOut = form.isLeaving === 'Leaving' ? form.timeOut : '';
  const sessionTimeFieldErrors = useMemo(() => {
    if (form.intakeStudentStatus === 'Other') return {};
    return getIntakeSessionTimeFieldErrors({
      intakeSession: form.intakeSession,
      timeIn: form.timeIn,
      timeOut: sessionTimeOut || null,
      sessions: intakeSessions,
    });
  }, [
    form.intakeStudentStatus,
    form.intakeSession,
    form.timeIn,
    sessionTimeOut,
    intakeSessions,
  ]);
  const hasSessionTimeError = Boolean(
    sessionTimeFieldErrors.timeIn || sessionTimeFieldErrors.timeOut,
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

  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    fetch('/api/admin/addresses/verify')
      .then(r => r.ok ? r.json() : null)
      .then(d => setGeoclientConfigured(d?.configured ?? false))
      .catch(() => setGeoclientConfigured(false));
  }, [authStatus]);

  useEffect(() => {
    if (form.intakeStudentStatus !== 'NEW') {
      setIntakeAddress({ address: '', apt: '', city: '', state: 'NY', zip: '' });
      setAddressVerification(null);
    }
  }, [form.intakeStudentStatus]);

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

  // Debounced duplicate check: name, DOB, and address (when available)
  const runDuplicateCheck = useCallback(async (
    f: ReturnType<typeof emptyForm>,
    addr: IntakeAddressValues,
    verification: IntakeAddressVerification | null,
  ) => {
    if (['Other', 'RETURNING'].includes(f.intakeStudentStatus)) {
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
        body: JSON.stringify({
          firstName: f.firstName.trim(),
          lastName: f.lastName.trim(),
          dob: f.dob,
          address: addr.address.trim() || undefined,
          apt: addr.apt.trim() || undefined,
          city: addr.city.trim() || undefined,
          state: addr.state.trim() || undefined,
          zip: addr.zip.trim() || undefined,
          standardized: verification?.standardized ?? undefined,
          geoclient: verification?.geoclient ?? undefined,
        }),
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

  const scheduleCheck = useCallback((
    f: ReturnType<typeof emptyForm>,
    addr = intakeAddress,
    verification = addressVerification,
  ) => {
    if (checkTimeout.current) clearTimeout(checkTimeout.current);
    checkTimeout.current = setTimeout(
      () => runDuplicateCheck(f, addr, verification),
      600,
    );
  }, [runDuplicateCheck, intakeAddress, addressVerification]);

  useEffect(() => {
    if (form.intakeStudentStatus !== 'NEW') return;
    scheduleCheck(form, intakeAddress, addressVerification);
  }, [
    form.intakeStudentStatus,
    form.firstName,
    form.lastName,
    form.dob,
    intakeAddress,
    addressVerification,
    scheduleCheck,
  ]);

  function setField(key: keyof ReturnType<typeof emptyForm>, value: string) {
    if (key === 'firstName' || key === 'lastName') {
      value = sanitizeUsaNameInput(value);
    }
    const updated = { ...form, [key]: value };
    setForm(updated);
    if (['firstName', 'lastName', 'dob'].includes(key)) {
      setSiblingAcknowledged(false);
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

  async function runSchoolLookup(query: string) {
    const q = query.trim();
    setSchoolLookup(q);
    if (!isStudentSearchQueryValid(q)) {
      setSchoolLookupResults([]);
      setSchoolLookupDone(false);
      return;
    }
    setSchoolLookupLoading(true);
    setSchoolLookupDone(false);
    try {
      const res = await fetch(`/api/students?search=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSchoolLookupResults(Array.isArray(data) ? data.slice(0, 12) : []);
      setSchoolLookupDone(true);
    } catch {
      setSchoolLookupResults([]);
      setSchoolLookupDone(true);
    } finally {
      setSchoolLookupLoading(false);
    }
  }

  function applyStudentAddressFromRecord(s: {
    address?: string;
    apt?: string;
    city?: string;
    state?: string;
    zip?: string;
    addressValidationStatus?: string;
    addressValidationWarnings?: string[];
    addressGeoclient?: { latitude?: number; longitude?: number };
  }) {
    setIntakeAddress({
      address: s.address ?? '',
      apt: s.apt ?? '',
      city: s.city ?? '',
      state: s.state ?? 'NY',
      zip: s.zip ?? '',
    });
    setAddressVerification(
      s.addressValidationStatus
        ? {
            status: s.addressValidationStatus,
            warnings: Array.isArray(s.addressValidationWarnings)
              ? s.addressValidationWarnings
              : [],
            geoclient: s.addressGeoclient,
          }
        : null,
    );
  }

  /** Switch to RETURNING and lock this existing (possibly archived) student. */
  function selectAsReturning(s: IntakeMatchStudent | any) {
    setForm(f => ({
      ...f,
      intakeStudentStatus: 'RETURNING',
      firstName: s.firstName ?? '',
      lastName: s.lastName ?? '',
      dob: s.dob ?? '',
      email: s.email ?? f.email,
      phone: s.phone ?? f.phone,
      gender: s.gender ?? f.gender,
      originalStartDate: s.originalStartDate || s.startDate || f.originalStartDate,
      ...emptyReturningVisitFields(),
    }));
    setSelectedExistingStudent(s);
    setStudentSearch(`${s.firstName || ''} ${s.lastName || ''}`.trim());
    setStudentSearchResults([]);
    setSchoolLookupResults([]);
    setSchoolLookupDone(false);
    setSchoolLookup('');
    setCheckResult({ status: 'idle', exact: [], fuzzy: [] });
    setSiblingAcknowledged(false);
    applyStudentAddressFromRecord(s);
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

      // RETURNING with a selected student updates the record and appends a visit.
      const isUpdatingExisting =
        status === 'RETURNING' && !!selectedExistingStudent?._id;

      if (status === 'RETURNING' && !selectedExistingStudent?._id) {
        setSubmitError('Please search for and select the student to log this visit.');
        return;
      }

      // New registrations: USA alphabet only (A–Z, spaces, hyphens)
      if (!isUpdatingExisting && status !== 'Other') {
        const firstErr = usaNameError(form.firstName, 'First name');
        const lastErr = usaNameError(form.lastName, 'Last name');
        if (firstErr || lastErr) {
          setSubmitError(firstErr || lastErr || USA_NAME_HINT);
          return;
        }
      }

      const timeOut = (form.isLeaving === 'Leaving') ? (form.timeOut || undefined) : undefined;

      const sessionTimeError = validateIntakeSessionTimes({
        intakeSession: form.intakeSession,
        timeIn: form.timeIn,
        timeOut: timeOut ?? null,
        sessions: intakeSessions,
      });
      if (sessionTimeError) {
        setSubmitError(sessionTimeError);
        return;
      }

      const needsNewDrawer =
        isUpdatingExisting && returningStudentNeedsNewDrawer(selectedExistingStudent);

      if (needsNewDrawer && !nextSlot) {
        setSubmitError(
          'No available drawer space for this returning student. Ask your Data Lead to create an active cabinet.',
        );
        return;
      }

      const keepArchivedFileLocation = isUpdatingExisting && (
        studentIsArchived(selectedExistingStudent)
        || studentHasArchiveBoxLocation(selectedExistingStudent)
      );

      const cabinetAssignment = isUpdatingExisting && !needsNewDrawer && !keepArchivedFileLocation
        ? selectedExistingStudent.cabinet
        : (needsNewDrawer ? nextSlot!.cabinet._id : (form.cabinet || undefined));

      const drawerAssignment = isUpdatingExisting && !needsNewDrawer && !keepArchivedFileLocation
        ? selectedExistingStudent.drawer
        : (needsNewDrawer ? nextSlot!.drawer._id : (form.drawer || undefined));

      const payload: Record<string, any> = {
        fiscalYear: currentFiscalYear,
        otherNote: (status === 'Other') ? form.otherNote.trim() || undefined : undefined,
      };

      if (!keepArchivedFileLocation) {
        payload.status = 'Active';
        payload.cabinet = cabinetAssignment;
        payload.drawer = drawerAssignment;
        if (needsNewDrawer) payload.reactivateFromArchive = true;
      }

      if (isUpdatingExisting) {
        // Returning visit: append a full visit record — do not overwrite top-level intake fields.
        payload.intakeStudentStatus = status;
      } else {
        payload.notes = form.notes.trim() || undefined;
        payload.intakeStudentStatus = status;
        payload.educationStatus = form.educationStatus || undefined;
        payload.intakeActivity = form.intakeActivity.length ? form.intakeActivity : undefined;
        payload.placementClass = form.placementClass.trim() || undefined;
        payload.intakeSession = form.intakeSession || undefined;
        payload.timeIn = form.timeIn || undefined;
        payload.isLeaving = form.isLeaving || undefined;
        payload.timeOut = timeOut;
        payload.firstName = form.firstName.trim();
        payload.lastName = form.lastName.trim();
        payload.dob = form.dob;
        payload.email = form.email.trim() || undefined;
        payload.phone = form.phone.trim() || undefined;
        payload.gender = form.gender || undefined;
        payload.startDate = (status === 'NEW') ? form.startDate : undefined;
        payload.originalStartDate =
          (status !== 'NEW' && status !== 'Other') ? form.originalStartDate || undefined : undefined;
      }

      if (status === 'NEW' && intakeAddress.address.trim()) {
        payload.address = intakeAddress.address.trim();
        payload.apt = intakeAddress.apt.trim() || undefined;
        payload.city = intakeAddress.city.trim() || undefined;
        payload.state = intakeAddress.state.trim() || undefined;
        payload.zip = intakeAddress.zip.trim() || undefined;
        payload.verifyAddress = true;
      }

      // When updating an existing record, append a self-contained visit (full snapshot).
      if (isUpdatingExisting && form.timeIn) {
        payload.appendVisit = {
          date: new Date().toISOString(),
          timeIn: form.timeIn,
          timeOut: timeOut || null,
          isLeaving: form.isLeaving || null,
          intakeSession: form.intakeSession || null,
          intakeActivity: form.intakeActivity,
          educationStatus: form.educationStatus || null,
          placementClass: form.placementClass.trim() || null,
          notes: form.notes.trim() || null,
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
        const hasDifferentAddress = [...checkResult.exact, ...checkResult.fuzzy].some(
          (s: { _addressMatch?: AddressMatchKind }) => s._addressMatch === 'different',
        );
        if (hasDifferentAddress) {
          payload.registeredWithNewAddress = true;
          payload.newAddressReviewNote =
            'Registered with a different home address than a possible name match on file — verify move or sibling.';
        }
      }

      const res = isUpdatingExisting
        ? await fetch(`/api/students/${normalizeMongoId(selectedExistingStudent._id) ?? selectedExistingStudent._id}`, {
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
        const d = await res.json().catch(() => ({}));
        const detail = typeof d.details === 'string' && d.details ? `: ${d.details}` : '';
        setSubmitError((d.error || 'Failed to save student') + detail);
        return;
      }
      const student = await res.json();
      setSavedAsVisit(isUpdatingExisting);
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

    if (form.intakeStudentStatus !== 'Other' && hasSessionTimeError) {
      setSubmitError(
        sessionTimeFieldErrors.timeIn
        ?? sessionTimeFieldErrors.timeOut
        ?? 'Times must fall within the selected intake session window.',
      );
      return;
    }

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
    setSavedAsVisit(false);
    setSubmitError('');
    setSelectedExistingStudent(null);
    setStudentSearch('');
    setStudentSearchResults([]);
    setIntakeAddress({ address: '', apt: '', city: '', state: 'NY', zip: '' });
    setAddressVerification(null);
  }

  if (authStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── SUCCESS SUMMARY ─────────────────────────────────────────────────────────
  if (savedStudent) {
    const ageCheck = savedStudent.dob ? checkBeEslAgeEligibility(String(savedStudent.dob)) : null;
    const showP2gReferral = Boolean(ageCheck?.validDob && !ageCheck.eligible);

    async function handleCopyP2gMessage() {
      try {
        await navigator.clipboard.writeText(buildP2gReferralMessage(savedStudent, form, session?.user));
        setP2gCopied(true);
        setTimeout(() => setP2gCopied(false), 2500);
      } catch {
        // ignore
      }
    }

    return (
      <div className="min-h-screen bg-green-50 dark:bg-green-950/20 flex flex-col items-center justify-center p-6 gap-6">
        <div className="flex items-center gap-3 text-green-700 dark:text-green-400">
          <CheckCircle2 className="h-8 w-8" />
          <h1 className="text-2xl font-bold">
            {savedAsVisit ? 'Visit Logged!' : 'Student Registered!'}
          </h1>
        </div>

        <IntakeSuccessSummary
          student={savedStudent}
          form={form}
          savedAsVisit={savedAsVisit}
          intakeSessions={intakeSessions}
          cabinets={cabinets}
        />

        {showP2gReferral && ageCheck && (
          <Card className="w-full max-w-lg border-sky-300 bg-sky-50/80 dark:bg-sky-950/25 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-sky-900 dark:text-sky-100">
                <Users className="h-4 w-4" />
                Under 21 — refer to Pathways to Graduation (P2G)
              </CardTitle>
              <CardDescription className="text-sky-800/90 dark:text-sky-200/90 text-sm">
                This student is not yet eligible for BE or ESL (must be 21). Copy the message below to
                email or share with the student so they can contact P2G.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <pre className="text-xs whitespace-pre-wrap rounded-md border border-sky-200 bg-white/90 dark:bg-background p-3 text-foreground font-sans leading-relaxed max-h-64 overflow-y-auto">
                {buildP2gReferralMessage(savedStudent, form, session?.user)}
              </pre>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  className="gap-1.5 bg-sky-700 hover:bg-sky-800"
                  onClick={handleCopyP2gMessage}
                >
                  {p2gCopied
                    ? <><Check className="h-3.5 w-3.5" /> Copied!</>
                    : <><Copy className="h-3.5 w-3.5" /> Copy message for email</>}
                </Button>
                <Button type="button" variant="outline" size="sm" className="gap-1.5" asChild>
                  <a href="https://p2g.nyc/contact/" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                    P2G contact page
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Button variant="outline" onClick={resetForm} className="gap-2">
          <RotateCcw className="h-4 w-4" /> {savedAsVisit ? 'Log Another Visit' : 'Register Another Student'}
        </Button>
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

    const incomingAddr = formatStudentAddressStacked(
      addressVerification?.standardized ?? intakeAddress,
    );
    const lines: string[] = [
      `⚠️  Possible Duplicate — Intake Alert`,
      `Date: ${now}`,
      ``,
      `New student being registered:`,
      `  Name: ${incomingName}`,
      `  DOB:  ${dobFormatted}`,
      ...(incomingAddr?.streetLine
        ? [`  Address: ${incomingAddr.streetLine}${incomingAddr.cityStateZip ? `, ${incomingAddr.cityStateZip}` : ''}`]
        : []),
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
      if (s._addressMatch) {
        lines.push(`     Address: ${addressMatchLabel(s._addressMatch)}`);
        if (s._addressExisting) lines.push(`     On file: ${s._addressExisting}`);
      }
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

  const showMainIntakeFields =
    form.intakeStudentStatus !== 'RETURNING' || !!selectedExistingStudent;

  const profileLocked =
    form.intakeStudentStatus === 'RETURNING' && !!selectedExistingStudent;

  const lockedFieldClass = profileLocked ? 'bg-muted/50 cursor-default' : undefined;

  // ── INTAKE FORM ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-40">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
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
          <div className="flex items-center gap-2 sm:gap-3">
            {activeTab === 'register' && (
              <Button
                variant="outline"
                size="sm"
                onClick={resetForm}
                disabled={submitting || cabinetsLoading}
                className="gap-1.5"
              >
                <RotateCcw className="h-4 w-4" />
                <span className="hidden sm:inline">Reset</span>
              </Button>
            )}
            <GoogleTranslate />
            <span className="text-sm text-muted-foreground hidden sm:inline">{session?.user?.name}</span>
            <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: '/auth/signin' })} className="gap-1.5 text-muted-foreground">
              <LogOut className="h-4 w-4" /> Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        <IntakeIssuesBanner
          reviewHref="/intake"
          refreshToken={issuesRefresh}
          onFixStudent={issue => setFixTarget({
            id: issue.studentId,
            name: `${issue.firstName} ${issue.lastName}`,
          })}
        />

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

        <IntakeMemberGuide />

        {/* Always-on school roster check (active + archived) */}
        <Card className="border-sky-200 dark:border-sky-900 bg-sky-50/40 dark:bg-sky-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-sky-900 dark:text-sky-200">
              <Users className="h-4 w-4" />
              Check school records first
            </CardTitle>
            <CardDescription className="text-xs">
              Search active and archived students by name, Label ID, or DOB before registering as NEW.
              If you find them, use <strong className="text-foreground">Same person — log returning</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Name, Label ID, or DOB (MM/DD/YYYY)…"
                value={schoolLookup}
                onChange={e => {
                  const v = e.target.value;
                  setSchoolLookup(v);
                  if (schoolLookupTimeout.current) clearTimeout(schoolLookupTimeout.current);
                  schoolLookupTimeout.current = setTimeout(() => runSchoolLookup(v), 350);
                }}
                className="flex-1 bg-background"
              />
              {schoolLookupLoading && (
                <Loader2 className="h-4 w-4 animate-spin self-center text-muted-foreground" />
              )}
            </div>
            {schoolLookupDone && schoolLookupResults.length === 0 && isStudentSearchQueryValid(schoolLookup) && (
              <Alert className="border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800 dark:text-green-200 text-sm">No school match</AlertTitle>
                <AlertDescription className="text-xs text-green-700 dark:text-green-300">
                  No active or archived student matched this search. Safe to continue as NEW if name and DOB are correct.
                </AlertDescription>
              </Alert>
            )}
            {schoolLookupResults.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {schoolLookupResults.map((s: any) => (
                  <IntakeMatchCard
                    key={s._id}
                    student={s}
                    onUseAsReturning={selectAsReturning}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Duplicate check panel */}
        {checkResult.status === 'checking' && (
          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>Checking for existing records…</AlertDescription>
          </Alert>
        )}

        {checkResult.status === 'clear' && form.intakeStudentStatus === 'NEW' && form.dob && (
          <Alert className="border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertTitle className="text-green-800 dark:text-green-200">No existing records found</AlertTitle>
            <AlertDescription className="text-green-700 dark:text-green-300">
              This student does not appear to be in the system yet (including archived files). Safe to register.
              {!intakeAddress.address.trim() && (
                <span className="block mt-1 text-green-600/90">
                  Tip: add and verify the home address for a stronger duplicate check.
                </span>
              )}
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
                  Review name, DOB, and address before registering. A different address may mean the student moved — it does not clear a name match.
                </p>
              </div>
            </div>

            {/* Matched records */}
            <div className="space-y-1.5">
              {[...checkResult.exact, ...checkResult.fuzzy].map((s, i) => (
                <IntakeMatchCard
                  key={s._id || i}
                  student={s}
                  onUseAsReturning={selectAsReturning}
                />
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

          {form.intakeStudentStatus === 'RETURNING' && !selectedExistingStudent && (
            <Alert className="border-blue-200 bg-blue-50/60 dark:bg-blue-950/20 dark:border-blue-800">
              <Clock className="h-4 w-4 text-blue-700" />
              <AlertTitle className="text-blue-900 dark:text-blue-100 text-sm">Log a returning visit</AlertTitle>
              <AlertDescription className="text-xs text-blue-800 dark:text-blue-200">
                Search for the student below, complete today&apos;s intake details on this screen, then submit to add the visit to their record.
              </AlertDescription>
            </Alert>
          )}

          {/* ── Returning: find student & log visit on same screen ───────── */}
          {form.intakeStudentStatus === 'RETURNING' && (
            <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2 text-blue-800 dark:text-blue-300">
                  <Users className="h-4 w-4" /> Find Existing Student
                </CardTitle>
                <CardDescription className="text-xs">
                  Search active and archived students. Archived matches show their archive box so you do not create a second file.
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
                  <div className="space-y-1.5 max-h-56 overflow-y-auto">
                    {studentSearchResults.map(s => (
                      <IntakeMatchCard
                        key={s._id}
                        student={s}
                        onSelect={selectAsReturning}
                        showUseButton={false}
                      />
                    ))}
                  </div>
                )}
                {selectedExistingStudent && (
                  <div className="space-y-2">
                    <div className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                      studentIsArchived(selectedExistingStudent)
                        ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/30'
                        : 'border-green-300 bg-green-50 dark:bg-green-950/30'
                    }`}>
                      <CheckCircle2 className={`h-4 w-4 shrink-0 ${
                        studentIsArchived(selectedExistingStudent) ? 'text-amber-600' : 'text-green-600'
                      }`} />
                      <span className="flex-1 font-medium">
                        {selectedExistingStudent.firstName} {selectedExistingStudent.lastName}
                      </span>
                      {studentIsArchived(selectedExistingStudent) && (
                        <Badge className="text-[10px] bg-amber-600 hover:bg-amber-600 text-white gap-1">
                          <Archive className="h-3 w-3" />
                          Archived
                        </Badge>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedExistingStudent(null);
                          setStudentSearch('');
                          setForm(f => ({ ...f, ...emptyReturningVisitFields() }));
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Change
                      </button>
                    </div>
                    {Array.isArray(selectedExistingStudent.intakeVisits) && selectedExistingStudent.intakeVisits.length > 0 && (
                      <ReturningVisitHistory visits={selectedExistingStudent.intakeVisits} />
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {showMainIntakeFields && (
          <>
          {/* ── 2. PERSONAL INFORMATION ──────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4" /> Personal Information
                {profileLocked && (
                  <Badge variant="outline" className="ml-auto text-xs font-normal gap-1 text-muted-foreground">
                    <Lock className="h-3 w-3" /> From student record
                  </Badge>
                )}
              </CardTitle>
              {profileLocked && (
                <CardDescription className="text-xs">
                  Name and dates cannot be changed here. Update on All Students if corrections are needed.
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name <span className="text-destructive">*</span></Label>
                <Input
                  id="firstName"
                  value={form.firstName}
                  onChange={e => setField('firstName', e.target.value)}
                  placeholder="First name"
                  required
                  readOnly={profileLocked}
                  className={lockedFieldClass}
                  autoComplete="given-name"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name <span className="text-destructive">*</span></Label>
                <Input
                  id="lastName"
                  value={form.lastName}
                  onChange={e => setField('lastName', e.target.value)}
                  placeholder="Last name"
                  required
                  readOnly={profileLocked}
                  className={lockedFieldClass}
                  autoComplete="family-name"
                  spellCheck={false}
                />
              </div>
              {!profileLocked && (
                <p className="sm:col-span-2 text-xs text-muted-foreground -mt-1">
                  {USA_NAME_HINT}
                </p>
              )}
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
                    className={`sm:max-w-[220px] ${lockedFieldClass ?? ''}`}
                    required
                    readOnly={profileLocked}
                  />
                  {form.dob && <DateHumanHint value={form.dob} />}
                </div>
                {beEslAgeCheck && requiresBeEslAgeCheck(form) && (
                  <BeEslAgeHint check={beEslAgeCheck} />
                )}
                {!form.dob && form.intakeStudentStatus !== 'Other' && (
                  <p className="text-xs text-muted-foreground">
                    Students must be at least 21 years old to enroll in BE (Basic Education) or ESL.
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
              {['RETURNING', 'CTE Orientation'].includes(form.intakeStudentStatus) && (
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="originalStartDate">Original Start Date</Label>
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                    <Input
                      id="originalStartDate"
                      type="date"
                      value={form.originalStartDate}
                      onChange={e => setField('originalStartDate', e.target.value)}
                      className={`sm:max-w-[220px] ${lockedFieldClass ?? ''}`}
                      readOnly={profileLocked}
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

          {/* ── 2b. CONTACT & ADDRESS ─────────────────────────── */}
          {(form.intakeStudentStatus === 'NEW' || profileLocked) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <MapPin className="h-4 w-4" /> Contact &amp; Address
                  {profileLocked && (
                    <Badge variant="outline" className="ml-auto text-xs font-normal gap-1 text-muted-foreground">
                      <Lock className="h-3 w-3" /> From student record
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-xs">
                  {profileLocked
                    ? 'Contact and address on file. Update on All Students if corrections are needed.'
                    : 'Optional contact info. Verify the home address with NYC Geoclient before registering.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" /> Phone
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={form.phone}
                      onChange={e => setField('phone', e.target.value)}
                      placeholder="(555) 555-5555"
                      readOnly={profileLocked}
                      className={lockedFieldClass}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" /> Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={e => setField('email', e.target.value)}
                      placeholder="student@email.com"
                      readOnly={profileLocked}
                      className={lockedFieldClass}
                    />
                  </div>
                </div>
                <IntakeAddressFields
                  values={intakeAddress}
                  onChange={setIntakeAddress}
                  verification={addressVerification}
                  onVerificationChange={setAddressVerification}
                  geoclientConfigured={geoclientConfigured}
                  readOnly={profileLocked}
                />
              </CardContent>
            </Card>
          )}

          {/* ── 3. INTAKE DETAILS (all except Other) ─────────── */}
          {form.intakeStudentStatus !== 'Other' && (
            <>
              {profileLocked && (
                <Alert className="border-primary/30 bg-primary/5">
                  <ClipboardList className="h-4 w-4" />
                  <AlertTitle className="text-sm">Today&apos;s visit</AlertTitle>
                  <AlertDescription className="text-xs">
                    Complete fresh intake details for this visit. Previous visits are saved in the accordion above and are not changed.
                  </AlertDescription>
                </Alert>
              )}
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
                    {intakeActivityOptions.sort((a, b) => a.localeCompare(b)).map(activity => (
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
                            <td key={s.name} className="px-2 py-2 text-center font-semibold whitespace-nowrap">
                              <div>{s.name}</div>
                              <div className="text-[10px] font-normal text-muted-foreground mt-0.5">
                                {formatSessionTimeRange(s)}
                              </div>
                            </td>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t">
                          <td className="px-3 py-3"></td>
                          {intakeSessions.map(s => (
                            <td key={s.name} className="px-2 py-3 text-center">
                              <input
                                type="radio"
                                name="intakeSession"
                                value={s.name}
                                checked={form.intakeSession === s.name}
                                onChange={() => setField('intakeSession', s.name)}
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
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={form.timeIn}
                      onChange={e => setField('timeIn', e.target.value)}
                      className={cn('max-w-[180px]', sessionTimeFieldErrors.timeIn && 'border-destructive')}
                      aria-invalid={Boolean(sessionTimeFieldErrors.timeIn)}
                    />
                    <Button type="button" variant="outline" size="sm" onClick={() => setField('timeIn', nowHHMM())} className="gap-1.5">
                      <Clock className="h-3.5 w-3.5" /> Now
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Defaults to the current time — adjust if needed.
                    {form.intakeSession && findIntakeSession(intakeSessions, form.intakeSession) && (
                      <> Allowed window for {form.intakeSession}:{' '}
                        <strong>
                          {formatSessionTimeRange(findIntakeSession(intakeSessions, form.intakeSession)!)}
                        </strong>.
                      </>
                    )}
                  </p>
                  {sessionTimeFieldErrors.timeIn && (
                    <Alert variant="destructive" className="py-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-sm">{sessionTimeFieldErrors.timeIn}</AlertDescription>
                    </Alert>
                  )}
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
                          className={cn('max-w-[180px] bg-background', sessionTimeFieldErrors.timeOut && 'border-destructive')}
                          aria-invalid={Boolean(sessionTimeFieldErrors.timeOut)}
                          required
                        />
                        <Button type="button" variant="outline" size="sm" onClick={() => setField('timeOut', nowHHMM())} className="gap-1.5 bg-background">
                          <Clock className="h-3.5 w-3.5" /> Now
                        </Button>
                      </div>
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        You must enter a time out because the student is leaving the building.
                      </p>
                      {sessionTimeFieldErrors.timeOut && (
                        <Alert variant="destructive" className="py-2 bg-background">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="text-sm">{sessionTimeFieldErrors.timeOut}</AlertDescription>
                        </Alert>
                      )}
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
                  {selectedExistingStudent && studentIsArchived(selectedExistingStudent)
                    ? (studentHasArchiveBoxLocation(selectedExistingStudent)
                      ? 'Paperwork stays in archive storage — scan the QR code or open the box link if staff need to add documents.'
                      : 'Archived file — box location is not on record. Contact your Data Lead if paperwork is missing.')
                    : (selectedExistingStudent && returningStudentNeedsNewDrawer(selectedExistingStudent))
                      ? 'No active drawer on file — the next available space will be assigned.'
                      : (form.intakeStudentStatus === 'RETURNING' && selectedExistingStudent)
                        ? 'Keeps the existing file — no new space is assigned.'
                        : 'Automatically assigned to the next available drawer space.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {(form.intakeStudentStatus === 'RETURNING' && selectedExistingStudent) ? (
                  selectedExistingStudent ? (
                    studentIsArchived(selectedExistingStudent) ? (
                      <IntakeArchivedFileLocation student={selectedExistingStudent} />
                    ) : returningStudentNeedsNewDrawer(selectedExistingStudent) ? (
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
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs shrink-0 border-amber-400 text-amber-800 bg-amber-50">
                            New drawer
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
          </>
          )}

          {submitError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}

          {showMainIntakeFields && (
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
                (form.intakeStudentStatus !== 'Other' && hasSessionTimeError) ||
                (form.intakeStudentStatus === 'RETURNING' && !selectedExistingStudent) ||
                (form.intakeStudentStatus !== 'Other' &&
                  !(form.intakeStudentStatus === 'RETURNING' && selectedExistingStudent) &&
                  !nextSlot)
              }
              size="lg"
              className="gap-2 min-w-[160px]"
            >
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
              ) : form.intakeStudentStatus === 'RETURNING' ? (
                <><Clock className="h-4 w-4" /> Log Visit &amp; Save</>
              ) : (
                <><UserPlus className="h-4 w-4" /> Register Student</>
              )}
            </Button>
          </div>
          )}
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
              activityOptions={intakeActivityOptions}
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

      {fixTarget && (
        <IntakeHandoffFixDialog
          studentId={fixTarget.id}
          studentName={fixTarget.name}
          open={Boolean(fixTarget)}
          onOpenChange={open => { if (!open) setFixTarget(null); }}
          onFixed={() => {
            setIssuesRefresh(n => n + 1);
            fetchHistory(historyFilter, historyScope);
          }}
        />
      )}
    </div>
  );
}

// ── Reprint a single history row label ──────────────────────────────────────

function ReprintHistoryLabel({ student }: { student: any }) {
  const [open, setOpen] = useState(false);
  const [layout, setLayout] = useState<'avery5163' | 'avery94205'>('avery5163');
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      const { downloadAveryDocx } = await import('@/lib/downloadAveryDocx');
      await downloadAveryDocx(layout, [student]);
    } catch {
      alert('Error generating Word document. Please try again.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground shrink-0"
        onClick={() => setOpen(true)} title="Download Word label">
        <FileText className="h-4 w-4" />
        <span className="hidden sm:inline">Word Doc</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Download Label (Word)</DialogTitle>
            <DialogDescription>
              {student.firstName} {student.lastName} — print from Word on Letter at 100%
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Layout</Label>
              <Select value={layout} onValueChange={(v) => setLayout(v as 'avery5163' | 'avery94205')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="avery5163">Avery 5163 (2"×4")</SelectItem>
                  <SelectItem value="avery94205">Avery 94205 (1.5"×3.75")</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <AveryPrintGuidance layout={layout} />
            <div
              className="mx-auto bg-white"
              style={{
                width: layout === 'avery5163' ? '4in' : '3.75in',
                height: layout === 'avery5163' ? '2in' : '1.5in',
                boxSizing: 'border-box',
                padding: '0.07in 0.1in',
                border: '1px dashed #bbb',
              }}
            >
              {layout === 'avery5163' ? (
                <Avery5163LabelContent student={student} />
              ) : (
                <Avery94205LabelContent student={student} />
              )}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
            <Button onClick={handleDownload} disabled={downloading} className="gap-2">
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {downloading ? 'Generating…' : 'Download Word Doc'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function VisitActivityPicker({
  options,
  value,
  onChange,
  idPrefix,
}: {
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  idPrefix: string;
}) {
  function toggle(activity: string) {
    onChange(
      value.includes(activity)
        ? value.filter(a => a !== activity)
        : [...value, activity],
    );
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Intake Activity</Label>
      <div className="grid grid-cols-1 gap-1.5">
        {options.map(activity => (
          <label
            key={activity}
            className="flex items-center gap-2.5 cursor-pointer select-none rounded-md border px-2.5 py-2 hover:bg-accent transition-colors"
          >
            <Checkbox
              checked={value.includes(activity)}
              onCheckedChange={() => toggle(activity)}
              id={`${idPrefix}-${activity}`}
            />
            <span className="text-sm">{activity}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// ── Add-Visit button (log another time for a returning student) ──────────────
function AddVisitButton({
  student,
  activityOptions,
  onSaved,
}: {
  student: any;
  activityOptions: string[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [visitDate, setVisitDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [timeIn, setTimeIn] = useState(nowHHMM());
  const [leaving, setLeaving] = useState<'Leaving' | 'Staying' | ''>('');
  const [timeOut, setTimeOut] = useState('');
  const [activities, setActivities] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const priorVisits: any[] = Array.isArray(student.intakeVisits) ? student.intakeVisits : [];
  const priorTotal = totalVisitMinutes(priorVisits);

  function visitDateIso(date: string, time: string) {
    const [h, m] = time.split(':').map(v => parseInt(v, 10));
    const d = new Date(`${date}T00:00:00`);
    if (!Number.isNaN(h) && !Number.isNaN(m)) d.setHours(h, m, 0, 0);
    return d.toISOString();
  }

  function reset() {
    const d = new Date();
    setVisitDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    setTimeIn(nowHHMM()); setLeaving(''); setTimeOut(''); setActivities([]); setError('');
  }

  async function save() {
    if (!visitDate) { setError('Please select the activity date.'); return; }
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
          appendVisit: {
            date: visitDateIso(visitDate, timeIn),
            timeIn,
            timeOut: out ?? null,
            isLeaving: leaving || null,
            intakeActivity: activities,
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
        <DialogContent className="max-w-md">
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
              <Label className="text-xs flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                Activity date
              </Label>
              <Input
                type="date"
                value={visitDate}
                onChange={e => setVisitDate(e.target.value)}
                className="max-w-[200px]"
              />
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

            <VisitActivityPicker
              options={activityOptions}
              value={activities}
              onChange={setActivities}
              idPrefix={`add-visit-${student._id}`}
            />

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

// ── History Panel ────────────────────────────────────────────────────────────

function buildP2gReferralMessage(
  student: {
    firstName?: string;
    lastName?: string;
    dob?: string;
    phone?: string;
    email?: string;
    labelId?: string;
    studentId?: string;
  },
  form: {
    phone?: string;
    email?: string;
    intakeStudentStatus?: string;
    educationStatus?: string;
  },
  user?: { name?: string | null; email?: string | null } | null,
): string {
  const name = `${student.firstName ?? ''} ${student.lastName ?? ''}`.trim() || '—';
  const dobLabel = student.dob ? (formatHumanDate(student.dob) ?? student.dob) : '—';
  const phone = form.phone?.trim() || student.phone?.trim() || '—';
  const email = form.email?.trim() || student.email?.trim() || '—';
  const studentId = student.labelId || student.studentId || '—';
  const staffName = user?.name || user?.email || 'Intake staff';
  const today = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
  const ageCheck = student.dob ? checkBeEslAgeEligibility(String(student.dob)) : null;
  const eligibleDate = ageCheck?.eligibleOnIso ? formatHumanDate(ageCheck.eligibleOnIso) : null;

  return [
    'Subject: Student referral — Pathways to Graduation (under 21)',
    '',
    'Hello,',
    '',
    'I am referring a student who is under 21 years of age and is not eligible for our BE/ESL programs. They may be a better fit for Pathways to Graduation (P2G).',
    '',
    'Student information:',
    `  Name: ${name}`,
    `  Date of birth: ${dobLabel}`,
    `  Student ID: ${studentId}`,
    `  Phone: ${phone}`,
    `  Email: ${email}`,
    ...(form.intakeStudentStatus ? [`  Intake status: ${form.intakeStudentStatus}`] : []),
    ...(form.educationStatus ? [`  Education interest: ${form.educationStatus}`] : []),
    ...(eligibleDate ? [`  BE/ESL eligible on: ${eligibleDate}`] : []),
    '',
    'Please direct the student to contact Pathways to Graduation for enrollment options:',
    '  https://p2g.nyc/contact/',
    '',
    `Recorded by: ${staffName}`,
    `Date: ${today}`,
    '',
    'Thank you.',
  ].join('\n');
}

function SummaryRow({ label, value }: { label: string; value?: ReactNode }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="flex justify-between gap-4 text-sm py-2 border-b border-border/40 last:border-0">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

function IntakeSuccessSummary({
  student,
  form,
  savedAsVisit,
  intakeSessions,
  cabinets,
}: {
  student: any;
  form: any;
  savedAsVisit: boolean;
  intakeSessions: IntakeSession[];
  cabinets: Cabinet[];
}) {
  const cabinetMap = Object.fromEntries(cabinets.map(c => [c._id, c.name]));
  const drawerMap = Object.fromEntries(
    cabinets.flatMap(c => c.drawers.map(d => [d._id, d.name])),
  );
  const storage = getStudentStorageDisplay(student, cabinetMap, drawerMap);
  const sessionConfig = findIntakeSession(intakeSessions, form.intakeSession);
  const address = formatStudentAddressStacked({
    address: student.address,
    apt: student.apt,
    city: student.city,
    state: student.state,
    zip: student.zip,
  });
  const mapsUrl = googleMapsSearchUrl({
    latitude: student.addressGeoclient?.latitude,
    longitude: student.addressGeoclient?.longitude,
    address: student.address,
    city: student.city,
    state: student.state,
    zip: student.zip,
  });
  const dobLabel = student.dob ? (formatHumanDate(student.dob) ?? student.dob) : null;

  return (
    <Card className="w-full max-w-lg shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">
          {student.firstName} {student.lastName}
        </CardTitle>
        <CardDescription>
          {savedAsVisit
            ? 'Today\'s visit was saved to this student\'s intake history.'
            : 'New student record created in the system.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{student.status || 'Active'}</Badge>
          {form.intakeStudentStatus && (
            <Badge variant="secondary">{form.intakeStudentStatus}</Badge>
          )}
          {student.siblingFlag && (
            <Badge variant="outline" className="text-xs border-amber-400 text-amber-700 bg-amber-50">
              <ShieldAlert className="h-3 w-3 mr-1" /> Sibling flag
            </Badge>
          )}
          {student.addressValidationStatus && (
            <Badge variant="outline" className="text-xs capitalize">
              Address: {String(student.addressValidationStatus).replace(/_/g, ' ')}
            </Badge>
          )}
        </div>

        <div className="rounded-md border bg-muted/20 px-3 py-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground py-2">
            {savedAsVisit ? 'Visit recorded' : 'Registration saved'}
          </p>
          <SummaryRow label="Student ID" value={student.labelId || student.studentId} />
          <SummaryRow label="Date of birth" value={dobLabel} />
          {!savedAsVisit && form.gender && <SummaryRow label="Gender" value={form.gender} />}
          {!savedAsVisit && form.startDate && (
            <SummaryRow label="Start date" value={formatHumanDate(form.startDate) ?? form.startDate} />
          )}
          {form.educationStatus && <SummaryRow label="BE or ESL" value={form.educationStatus} />}
          {form.intakeActivity?.length > 0 && (
            <SummaryRow label="Intake activity" value={form.intakeActivity.join(', ')} />
          )}
          {form.placementClass?.trim() && (
            <SummaryRow label="Placement class" value={form.placementClass.trim()} />
          )}
          {form.intakeSession && (
            <SummaryRow
              label="Session"
              value={sessionConfig
                ? `${form.intakeSession} (${formatSessionTimeRange(sessionConfig)})`
                : form.intakeSession}
            />
          )}
          {form.timeIn && (
            <SummaryRow label="Time in" value={formatTime12(form.timeIn)} />
          )}
          {form.isLeaving && <SummaryRow label="Leaving / staying" value={form.isLeaving} />}
          {form.isLeaving === 'Leaving' && form.timeOut && (
            <SummaryRow label="Time out" value={formatTime12(form.timeOut)} />
          )}
          {(form.phone?.trim() || student.phone) && (
            <SummaryRow label="Phone" value={form.phone?.trim() || student.phone} />
          )}
          {(form.email?.trim() || student.email) && (
            <SummaryRow label="Email" value={form.email?.trim() || student.email} />
          )}
          {form.notes?.trim() && <SummaryRow label="Notes" value={form.notes.trim()} />}
        </div>

        <div className="rounded-md border bg-muted/20 px-3 py-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground py-2">
            File location
          </p>
          <SummaryRow
            label={storage.primaryLabel}
            value={storage.primary}
          />
          <SummaryRow
            label={storage.secondaryLabel}
            value={storage.secondary}
          />
          {student.archiveBoxId && (
            <div className="pt-2 pb-1">
              <Button variant="link" size="sm" className="h-auto p-0 text-xs" asChild>
                <Link href={`/archive/box/${student.archiveBoxId}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  View archive box
                </Link>
              </Button>
            </div>
          )}
        </div>

        {address?.streetLine && (
          <div className="text-sm space-y-1">
            <div className="flex items-start gap-1.5 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <div>
                <p>{address.streetLine}</p>
                {address.cityStateZip && (
                  <p className="text-xs">{address.cityStateZip}</p>
                )}
              </div>
            </div>
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline ml-5"
              >
                <ExternalLink className="h-3 w-3" />
                View on Google Maps
              </a>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function IntakeArchivedFileLocation({ student }: { student: any }) {
  const [origin, setOrigin] = useState('');
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const hasBoxLocation = studentHasArchiveBoxLocation(student);
  const boxUrl = student.archiveBoxId && origin
    ? `${origin}/archive/box/${student.archiveBoxId}`
    : null;

  if (!hasBoxLocation) {
    return (
      <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
        <Boxes className="h-4 w-4 text-amber-600" />
        <AlertTitle>Archived — box location not recorded</AlertTitle>
        <AlertDescription className="text-sm">
          This student&apos;s file was archived but no archive box is on record. Ask your Data Lead
          to assign a box in Admin → Cabinets before adding paperwork to the physical file.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="rounded-lg border-2 border-dashed border-amber-300/50 bg-amber-50/40 dark:bg-amber-950/20 px-5 py-4 space-y-4">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40 border border-amber-300/50 flex-shrink-0">
          <Boxes className="h-5 w-5 text-amber-700 dark:text-amber-300" />
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="font-semibold text-foreground">
            {student.archiveBoxLabel || 'Archive box'}
          </div>
          {student.archiveSchoolYear && (
            <p className="text-xs text-muted-foreground">{student.archiveSchoolYear}</p>
          )}
          {student.archiveLocation && (
            <div className="flex items-start gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span><strong className="text-foreground">Storage:</strong> {student.archiveLocation}</span>
            </div>
          )}
        </div>
        <Badge variant="outline" className="text-xs shrink-0 border-amber-400 text-amber-800 bg-amber-50">
          Archived file
        </Badge>
      </div>

      {boxUrl && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-md border border-amber-200/80 bg-background/80 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="rounded-md border bg-white p-1.5">
              <QRCode value={boxUrl} size={88} level="M" />
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground flex items-center gap-1">
                <QrCode className="h-3.5 w-3.5" /> Scan to open archive box
              </p>
              <p>Staff can scan this code to find the box and add paperwork to the existing file.</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0" asChild>
            <Link href={`/archive/box/${student.archiveBoxId}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
              View archive box
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

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
  activityOptions: string[];
  onRefresh: () => void;
}

function HistoryPanel({
  students, loading, filter, onFilterChange,
  scope, onScopeChange, currentUserEmail, canViewAll,
  activityOptions,
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
                      <AddVisitButton student={s} activityOptions={activityOptions} onSaved={onRefresh} />
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
