'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import GoogleTranslate from '@/components/GoogleTranslate';
import AppTopBar from '@/components/AppTopBar';
import PageIntro from '@/components/PageIntro';
import { canUseAppShell } from '@/lib/navConfig';
import { useDarkMode } from '@/lib/useDarkMode';
import { isStudentSearchQueryValid, parseStudentSearchQuery } from '@/lib/studentSearch';
import { sanitizeUsaNameInput, usaNameError, USA_NAME_HINT } from '@/lib/usaName';
import { DEFAULT_INTAKE_ACTIVITIES, DEFAULT_INTAKE_SESSION_CONFIGS } from '@/lib/intakeDefaults';
import {
  getIntakeSessionTimeFieldErrors,
  validateIntakeSessionTimes,
  type IntakeSession,
} from '@/lib/intakeSession';
import { findNextAvailableSlot, returningStudentNeedsNewDrawer, studentHasArchiveBoxLocation, studentIsArchived, type NextCabinetSlot } from '@/lib/cabinets';
import { normalizeMongoId } from '@/lib/utils';
import {
  beEslAgeErrorMessage,
  checkBeEslAgeEligibility,
  evaluateIntakeDob,
  requiresBeEslAgeCheck,
} from '@/lib/beEslEligibility';
import { emptyReturningVisitFields, nowHHMM } from '@/lib/intakeVisitTime';
import { emptyIntakeForm, emptyIntakeCheckResult, hydrateIntakeForm, type IntakeCheckResult, type IntakeFormState } from '@/lib/intakeForm';
import { intakeDemographicsError, parseIntakeDemographics, normalizeMiddleInitial } from '@/lib/intakeDemographics';
import { cleanIdComponent } from '@/lib/studentId';
import IntakeAssistsGate from '@/components/IntakeAssistsGate';
import IntakePersonalInfoCard from '@/components/IntakePersonalInfoCard';
import IntakeDemographicsCard from '@/components/IntakeDemographicsCard';
import IntakeProgramDetails from '@/components/IntakeProgramDetails';
import IntakeFileAssignment from '@/components/IntakeFileAssignment';
import IntakeReturningFinder from '@/components/IntakeReturningFinder';
import { Cabinet } from '@/types/cabinet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  UserPlus, AlertCircle, CheckCircle2, RotateCcw,
  Loader2, ClipboardList,
  Clock, Users, Copy, Check, ExternalLink,
  Info, List,
} from 'lucide-react';
import IntakeIssuesBanner from '@/components/IntakeIssuesBanner';
import IntakeHandoffFixDialog from '@/components/IntakeHandoffFixDialog';
import {
  type IntakeAddressVerification,
  type IntakeAddressValues,
} from '@/components/IntakeAddressFields';
import { type IntakeMatchStudent } from '@/components/IntakeMatchCard';
import IntakeMemberGuide from '@/components/IntakeMemberGuide';
import HistoryPanel from '@/components/IntakeHistoryPanel';
import {
  IntakeSuccessSummary,
  buildP2gReferralMessage,
} from '@/components/IntakeSuccessView';
import { annotateAssistsSearchMatches } from '@/lib/intakeMatchAnnotate';
import { formatFullName } from '@/lib/personName';
import { parseStudentsListResponse } from '@/lib/studentsList';
import {
  buildIntakeDuplicateAlertMessage,
  stackedAddressForAlert,
} from '@/lib/intakeDuplicateAlert';
import {
  clearIntakeDraft,
  formatIntakeDraftSavedAt,
  intakeDraftUserKey,
  loadIntakeDraft,
  saveIntakeDraft,
  type IntakeDraftPayload,
} from '@/lib/intakeDraft';
import {
  type AddressMatchKind,
} from '@/lib/addressDuplicate';

const INTAKE_STATUS_OPTIONS = [
  { value: 'NEW',             label: 'NEW',       description: 'First-time student' },
  { value: 'RETURNING',       label: 'RETURNING', description: 'Returning or continuing intake — log another visit' },
  { value: 'CTE Orientation', label: 'CTE Orientation', description: 'Career & Technical Education orientation' },
  { value: 'Other',           label: 'Other',     description: 'Other purpose — describe below' },
];

type CheckResult = IntakeCheckResult;
const emptyCheckResult = emptyIntakeCheckResult;
const emptyForm = emptyIntakeForm;

interface NextSlot extends NextCabinetSlot {}

export default function IntakePage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const { darkMode, setDarkMode } = useDarkMode();

  const [form, setForm] = useState(emptyForm());
  const [cabinets, setCabinets] = useState<Cabinet[]>([]);
  const [cabinetsLoading, setCabinetsLoading] = useState(false);
  const [nextSlot, setNextSlot] = useState<NextSlot | null>(null);

  const [checkResult, setCheckResult] = useState<CheckResult>(emptyCheckResult());
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

  // NEW students: required ASISTS / legacy check before personal info
  const [assistsGateChecked, setAssistsGateChecked] = useState(false);
  const [assistsNotFoundAck, setAssistsNotFoundAck] = useState(false);
  const [assistsDifferentPersonAck, setAssistsDifferentPersonAck] = useState(false);
  const [assistsLegacySameAck, setAssistsLegacySameAck] = useState(false);
  const [assistsQuery, setAssistsQuery] = useState('');
  const assistsSearchTimeout = useRef<NodeJS.Timeout | null>(null);

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
  const [selectedExistingStudent, setSelectedExistingStudent] = useState<any>(null);
  /** ASISTS/legacy externalId to use as studentId when continuing as NEW */
  const [preferredStudentId, setPreferredStudentId] = useState<string | null>(null);
  const [issuesRefresh, setIssuesRefresh] = useState(0);
  const [fixTarget, setFixTarget] = useState<{ id: string; name: string } | null>(null);
  const [pendingDraft, setPendingDraft] = useState<IntakeDraftPayload | null>(null);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const draftUserKey = intakeDraftUserKey(session?.user);

  // Always-on school roster lookup (includes archived)
  const [schoolLookup, setSchoolLookup] = useState('');
  const [schoolLookupResults, setSchoolLookupResults] = useState<any[]>([]);
  const [schoolLookupLoading, setSchoolLookupLoading] = useState(false);
  const [schoolLookupDone, setSchoolLookupDone] = useState(false);

  const checkTimeout = useRef<NodeJS.Timeout | null>(null);
  const schoolLookupTimeout = useRef<NodeJS.Timeout | null>(null);
  const dobDuplicatePanelRef = useRef<HTMLDivElement | null>(null);
  const prevCheckStatusRef = useRef<CheckResult['status']>('idle');

  const intakeDobEval = useMemo(
    () =>
      evaluateIntakeDob(form.dob || '', {
        requiresBeEsl: requiresBeEslAgeCheck(form),
      }),
    [form.dob, form.intakeStudentStatus, form.educationStatus],
  );
  const dobBlocksForm = Boolean(form.dob && intakeDobEval.blocksForm);
  const beEslAgeCheck = form.dob ? intakeDobEval.beEsl : null;

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

  // Offer resume of unfinished intake (survives idle sign-out on this browser)
  useEffect(() => {
    if (authStatus !== 'authenticated' || draftHydrated) return;
    setPendingDraft(loadIntakeDraft(draftUserKey));
    setDraftHydrated(true);
  }, [authStatus, draftUserKey, draftHydrated]);

  // Autosave draft while registering (not while a pending restore banner is open)
  useEffect(() => {
    if (!draftHydrated || pendingDraft || savedStudent || authStatus !== 'authenticated') return;
    const timer = window.setTimeout(() => {
      saveIntakeDraft(draftUserKey, {
        form,
        intakeAddress,
        addressVerification,
        assistsQuery,
        assistsGateChecked,
        assistsNotFoundAck,
        assistsDifferentPersonAck,
        assistsLegacySameAck,
        preferredStudentId,
        siblingAcknowledged,
        selectedExistingStudent: selectedExistingStudent
          ? {
              _id: selectedExistingStudent._id,
              firstName: selectedExistingStudent.firstName,
              lastName: selectedExistingStudent.lastName,
              dob: selectedExistingStudent.dob,
              labelId: selectedExistingStudent.labelId,
              studentId: selectedExistingStudent.studentId,
              status: selectedExistingStudent.status,
              archived: selectedExistingStudent.archived,
              cabinet: selectedExistingStudent.cabinet,
              drawer: selectedExistingStudent.drawer,
              archiveBoxId: selectedExistingStudent.archiveBoxId,
              archiveBoxLabel: selectedExistingStudent.archiveBoxLabel,
              archiveLocation: selectedExistingStudent.archiveLocation,
              archiveSchoolYear: selectedExistingStudent.archiveSchoolYear,
              intakeVisits: selectedExistingStudent.intakeVisits,
              phone: selectedExistingStudent.phone,
              homePhone: selectedExistingStudent.homePhone,
              cellPhone: selectedExistingStudent.cellPhone,
              middleInitial: selectedExistingStudent.middleInitial,
              email: selectedExistingStudent.email,
              address: selectedExistingStudent.address,
              apt: selectedExistingStudent.apt,
              city: selectedExistingStudent.city,
              state: selectedExistingStudent.state,
              zip: selectedExistingStudent.zip,
              originalStartDate: selectedExistingStudent.originalStartDate,
            }
          : null,
      });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [
    draftHydrated,
    pendingDraft,
    savedStudent,
    authStatus,
    draftUserKey,
    form,
    intakeAddress,
    addressVerification,
    assistsQuery,
    assistsGateChecked,
    assistsNotFoundAck,
    assistsDifferentPersonAck,
    assistsLegacySameAck,
    preferredStudentId,
    siblingAcknowledged,
    selectedExistingStudent,
  ]);

  function resumePendingDraft() {
    if (!pendingDraft) return;
    const d = pendingDraft;
    setForm(hydrateIntakeForm(d.form));
    setIntakeAddress(d.intakeAddress);
    setAddressVerification(d.addressVerification);
    setAssistsQuery(d.assistsQuery || '');
    setAssistsGateChecked(Boolean(d.assistsGateChecked));
    setAssistsNotFoundAck(Boolean(d.assistsNotFoundAck));
    setAssistsDifferentPersonAck(Boolean(d.assistsDifferentPersonAck));
    setAssistsLegacySameAck(Boolean(d.assistsLegacySameAck));
    setPreferredStudentId(d.preferredStudentId || null);
    setSiblingAcknowledged(Boolean(d.siblingAcknowledged));
    setSelectedExistingStudent(d.selectedExistingStudent);
    setPendingDraft(null);
    setActiveTab('register');
  }

  function discardPendingDraft() {
    clearIntakeDraft(draftUserKey);
    setPendingDraft(null);
  }

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

  const { cabinetMap, drawerMap } = useMemo(() => {
    const nextCabinet: Record<string, string> = {};
    const nextDrawer: Record<string, string> = {};
    for (const c of cabinets) {
      const cabId = normalizeMongoId(c._id) ?? String(c._id);
      const cabName = c.name || c.identifier || cabId;
      if (cabId) nextCabinet[cabId] = cabName;
      for (const d of c.drawers || []) {
        const drawerId = normalizeMongoId(d._id) ?? String(d._id);
        if (drawerId) nextDrawer[drawerId] = d.name || drawerId;
      }
    }
    return { cabinetMap: nextCabinet, drawerMap: nextDrawer };
  }, [cabinets]);

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
      params.set('limit', '200');
      const res = await fetch(`/api/students?${params.toString()}`);
      const data = await res.json();
      setHistoryStudents(parseStudentsListResponse(data).students);
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
  // For NEW students this runs after the ASISTS gate unlocks (and when address changes).
  const runDuplicateCheck = useCallback(async (
    f: ReturnType<typeof emptyForm>,
    addr: IntakeAddressValues,
    verification: IntakeAddressVerification | null,
    opts?: { fromAssistsGate?: boolean },
  ) => {
    if (['Other', 'RETURNING'].includes(f.intakeStudentStatus)) {
      setCheckResult(emptyCheckResult());
      return;
    }
    // Full identity check needs name + DOB. Never wipe ASISTS gate matches when
    // Personal Info is still incomplete (DOB-only search → empty names was re-locking
    // the form after "Not the same person").
    if (!f.firstName.trim() || !f.lastName.trim() || !f.dob) {
      setCheckResult(r => {
        const hits =
          r.exact.length + r.fuzzy.length + r.legacyExact.length + r.legacyFuzzy.length;
        if (hits > 0) return { ...r, status: 'found' };
        return { ...emptyCheckResult(), status: 'needs_dob' };
      });
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
      const liveHits = (data.exact?.length || 0) + (data.fuzzy?.length || 0);
      const legacyHits = (data.legacyExact?.length || 0) + (data.legacyFuzzy?.length || 0);
      setCheckResult({
        status: liveHits + legacyHits > 0 ? 'found' : 'clear',
        exact: data.exact || [],
        fuzzy: data.fuzzy || [],
        legacyExact: data.legacyExact || [],
        legacyFuzzy: data.legacyFuzzy || [],
      });
      if (opts?.fromAssistsGate) {
        setAssistsGateChecked(true);
        setAssistsNotFoundAck(false);
        setAssistsDifferentPersonAck(false);
        setAssistsLegacySameAck(false);
        setSiblingAcknowledged(false);
      }
    } catch {
      setCheckResult(emptyCheckResult());
      if (opts?.fromAssistsGate) setAssistsGateChecked(false);
    }
  }, []);

  const scheduleCheck = useCallback((
    f: ReturnType<typeof emptyForm>,
    addr = intakeAddress,
    verification = addressVerification,
  ) => {
    // NEW: only auto-recheck after the ASISTS gate has unlocked registration
    if (f.intakeStudentStatus === 'NEW' && !assistsNotFoundAck && !assistsDifferentPersonAck && !assistsLegacySameAck) {
      return;
    }
    if (checkTimeout.current) clearTimeout(checkTimeout.current);
    checkTimeout.current = setTimeout(
      () => runDuplicateCheck(f, addr, verification),
      600,
    );
  }, [
    runDuplicateCheck,
    intakeAddress,
    addressVerification,
    assistsNotFoundAck,
    assistsDifferentPersonAck,
    assistsLegacySameAck,
  ]);

  useEffect(() => {
    if (form.intakeStudentStatus !== 'NEW') return;
    if (!assistsNotFoundAck && !assistsDifferentPersonAck && !assistsLegacySameAck) return;
    // Wait until Personal Info has a full identity — running early cleared gate matches.
    if (!form.firstName.trim() || !form.lastName.trim() || !form.dob) return;
    scheduleCheck(form, intakeAddress, addressVerification);
  }, [
    form.intakeStudentStatus,
    form.firstName,
    form.lastName,
    form.dob,
    intakeAddress,
    addressVerification,
    scheduleCheck,
    assistsNotFoundAck,
    assistsDifferentPersonAck,
    assistsLegacySameAck,
  ]);

  // When DOB/address check surfaces matches after unlock, bring the sibling panel into view.
  useEffect(() => {
    const prev = prevCheckStatusRef.current;
    prevCheckStatusRef.current = checkResult.status;
    if (
      form.intakeStudentStatus === 'NEW'
      && form.dob
      && checkResult.status === 'found'
      && prev !== 'found'
      && (assistsNotFoundAck || assistsDifferentPersonAck || assistsLegacySameAck)
    ) {
      requestAnimationFrame(() => {
        dobDuplicatePanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }
  }, [
    checkResult.status,
    form.dob,
    form.intakeStudentStatus,
    assistsNotFoundAck,
    assistsDifferentPersonAck,
    assistsLegacySameAck,
  ]);

  function resetAssistsGate(clearCheck = true) {
    setAssistsGateChecked(false);
    setAssistsNotFoundAck(false);
    setAssistsDifferentPersonAck(false);
    setAssistsLegacySameAck(false);
    setPreferredStudentId(null);
    if (clearCheck) setCheckResult(emptyCheckResult());
  }

  function setField<K extends keyof IntakeFormState>(key: K, value: IntakeFormState[K]) {
    let nextValue = value;
    if (key === 'firstName' || key === 'lastName') {
      nextValue = sanitizeUsaNameInput(String(value)) as IntakeFormState[K];
    }
    if (key === 'middleInitial') {
      nextValue = normalizeMiddleInitial(String(value)) as IntakeFormState[K];
    }
    setForm((current) => {
      const updated: IntakeFormState = { ...current, [key]: nextValue };
      if (key === 'homePhone') {
        updated.phone = String(nextValue);
        if (updated.homePhoneSameAsCell && updated.homePhone !== updated.cellPhone) {
          updated.homePhoneSameAsCell = false;
        }
      }
      if (key === 'cellPhone' && current.homePhoneSameAsCell) {
        updated.homePhone = String(nextValue);
        updated.phone = String(nextValue);
      }
      if (key === 'homePhoneSameAsCell' && nextValue === true) {
        updated.homePhone = current.cellPhone;
        updated.phone = current.cellPhone;
      }
      return updated;
    });
    // Do not clear sibling acknowledgement when typing first/last name — that is the
    // sibling path (different name, same DOB). Only reset when DOB itself changes.
    if (key === 'dob') {
      setSiblingAcknowledged(false);
    }
    if (key === 'intakeStudentStatus') {
      setCheckResult(emptyCheckResult());
      setSiblingAcknowledged(false);
      setSelectedExistingStudent(null);
      setAssistsQuery('');
      resetAssistsGate(false);
    }
  }

  /** Prefill name/DOB from free-text search when useful (not-found path or after search). */
  function applyParsedAssistsQueryToForm(query: string) {
    const parsed = parseStudentSearchQuery(query);
    setForm(f => ({
      ...f,
      firstName: parsed.firstName
        ? sanitizeUsaNameInput(parsed.firstName)
        : f.firstName,
      lastName: parsed.lastName
        ? sanitizeUsaNameInput(parsed.lastName)
        : f.lastName,
      dob: parsed.dobIso || f.dob,
    }));
  }

  async function runAssistsGateCheck(query = assistsQuery) {
    const q = query.trim();
    if (!isStudentSearchQueryValid(q)) {
      setSubmitError('Enter a name, date of birth (MM/DD/YYYY), or both to check ASISTS.');
      return;
    }
    setSubmitError('');
    setCheckResult(r => ({ ...r, status: 'checking' }));
    try {
      const [liveRes, legacyRes] = await Promise.all([
        fetch(`/api/students?search=${encodeURIComponent(q)}&source=intake`),
        fetch(`/api/admin/schools/legacy-roster/search?q=${encodeURIComponent(q)}`),
      ]);
      const liveData = await liveRes.json();
      const legacyData = legacyRes.ok ? await legacyRes.json() : { results: [] };
      const liveRaw = parseStudentsListResponse(liveData).students.slice(0, 12);
      const legacyRaw = Array.isArray(legacyData.results) ? legacyData.results.slice(0, 12) : [];
      const live = annotateAssistsSearchMatches(liveRaw, q);
      const legacy = annotateAssistsSearchMatches(legacyRaw, q);

      setCheckResult({
        status: live.length + legacy.length > 0 ? 'found' : 'clear',
        exact: live,
        fuzzy: [],
        legacyExact: legacy,
        legacyFuzzy: [],
      });
      setAssistsGateChecked(true);
      setAssistsNotFoundAck(false);
      setAssistsDifferentPersonAck(false);
      setAssistsLegacySameAck(false);
      setPreferredStudentId(null);
      setSiblingAcknowledged(false);

      // Soft-prefill from the query so Personal Info is closer when they continue
      applyParsedAssistsQueryToForm(q);
    } catch {
      setCheckResult(emptyCheckResult());
      setAssistsGateChecked(false);
      setSubmitError('ASISTS search failed. Try again.');
    }
  }

  function onAssistsQueryChange(value: string) {
    setAssistsQuery(value);
    if (assistsGateChecked) resetAssistsGate();
    if (assistsSearchTimeout.current) clearTimeout(assistsSearchTimeout.current);
    const q = value.trim();
    if (!isStudentSearchQueryValid(q)) return;
    assistsSearchTimeout.current = setTimeout(() => {
      runAssistsGateCheck(q);
    }, 450);
  }

  function confirmLegacySamePerson(s: IntakeMatchStudent | any) {
    setForm(f => ({
      ...f,
      firstName: sanitizeUsaNameInput(s.firstName ?? f.firstName),
      lastName: sanitizeUsaNameInput(s.lastName ?? f.lastName),
      dob: s.dob ?? f.dob,
    }));
    const assistsId = s.externalId ? cleanIdComponent(String(s.externalId)) : '';
    setPreferredStudentId(assistsId || null);
    setAssistsLegacySameAck(true);
    setAssistsDifferentPersonAck(false);
    setAssistsNotFoundAck(false);
    setSiblingAcknowledged(false);
  }

  function toggleActivity(activity: string) {
    setForm(f => ({
      ...f,
      intakeActivity: f.intakeActivity.includes(activity)
        ? f.intakeActivity.filter(a => a !== activity)
        : [...f.intakeActivity, activity],
    }));
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
      const [liveRes, legacyRes] = await Promise.all([
        fetch(`/api/students?search=${encodeURIComponent(q)}&source=intake`),
        fetch(`/api/admin/schools/legacy-roster/search?q=${encodeURIComponent(q)}`),
      ]);
      const liveData = await liveRes.json();
      const legacyData = legacyRes.ok ? await legacyRes.json() : { results: [] };
      const live = parseStudentsListResponse(liveData).students.slice(0, 12);
      const legacy = Array.isArray(legacyData.results) ? legacyData.results.slice(0, 12) : [];
      setSchoolLookupResults([...live, ...legacy]);
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
    if (s?._legacy) return; // ASISTS export only — not a live filing record
    setForm(f => ({
      ...f,
      intakeStudentStatus: 'RETURNING',
      firstName: s.firstName ?? '',
      lastName: s.lastName ?? '',
      middleInitial: s.middleInitial ?? f.middleInitial,
      dob: s.dob ?? '',
      email: s.email ?? f.email,
      homePhone: s.homePhone || s.phone || f.homePhone,
      phone: s.homePhone || s.phone || f.phone,
      cellPhone: s.cellPhone ?? f.cellPhone,
      homePhoneSameAsCell: Boolean(s.homePhoneSameAsCell),
      emergencyContactNameRelationship: s.emergencyContactNameRelationship ?? f.emergencyContactNameRelationship,
      emergencyContactPhone: s.emergencyContactPhone ?? f.emergencyContactPhone,
      gender: s.gender ?? f.gender,
      originalStartDate: s.originalStartDate || s.startDate || f.originalStartDate,
      ...emptyReturningVisitFields(),
    }));
    setSelectedExistingStudent(s);
    setSchoolLookupResults([]);
    setSchoolLookupDone(false);
    setSchoolLookup('');
    setCheckResult(emptyCheckResult());
    setSiblingAcknowledged(false);
    setAssistsQuery('');
    resetAssistsGate(false);
    applyStudentAddressFromRecord(s);
  }

  async function doSubmit() {
    setSubmitting(true);
    setSubmitError('');
    try {
      const status = form.intakeStudentStatus;

      if (form.dob && intakeDobEval.blocksForm) {
        setSubmitError(
          intakeDobEval.boundaryError
          || intakeDobEval.beEsl.ineligibleMessage
          || (beEslAgeCheck ? beEslAgeErrorMessage(beEslAgeCheck) : 'Date of birth is not eligible for intake.'),
        );
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
        payload.phone = form.homePhone.trim() || form.phone.trim() || undefined;
        payload.gender = form.gender || undefined;
        payload.startDate = (status === 'NEW') ? form.startDate : undefined;
        payload.originalStartDate =
          (status !== 'NEW' && status !== 'Other') ? form.originalStartDate || undefined : undefined;
        const demographics = parseIntakeDemographics(form, { required: status === 'NEW' });
        if (demographics.error) {
          setSubmitError(demographics.error);
          return;
        }
        Object.assign(payload, demographics.values);
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

      if (siblingAcknowledged || assistsDifferentPersonAck) {
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
      if (assistsNotFoundAck) {
        payload.assistsCheckedNotFound = true;
      }
      if (assistsLegacySameAck) {
        payload.assistsLegacySamePerson = true;
      }
      // Preserve full ASISTS ID (includes internal number) when continuing as NEW from legacy
      if (!isUpdatingExisting && preferredStudentId) {
        payload.studentId = preferredStudentId;
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
      clearIntakeDraft(draftUserKey);
      setPendingDraft(null);
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

    if (form.intakeStudentStatus === 'NEW' && !newAssistsUnlocked) {
      setSubmitError(
        assistsGateChecked
          ? 'Confirm whether the student matches an ASISTS / school record, or acknowledge that they were not found, before continuing.'
                      : 'Search ASISTS with a name, date of birth, or both before registering a NEW student.',
      );
      return;
    }

    if (form.intakeStudentStatus !== 'Other' && hasSessionTimeError) {
      setSubmitError(
        sessionTimeFieldErrors.timeIn
        ?? sessionTimeFieldErrors.timeOut
        ?? 'Times must fall within the selected intake session window.',
      );
      return;
    }

    const demographicsErr = intakeDemographicsError(form, {
      required: form.intakeStudentStatus === 'NEW',
    });
    if (demographicsErr) {
      setSubmitError(demographicsErr);
      return;
    }

    // Only block on duplicates for NEW students; RETURNING/CTE expect to find existing records
    const isNewStudent = form.intakeStudentStatus === 'NEW';
    const liveHits = checkResult.exact.length + checkResult.fuzzy.length;
    const legacyHits = checkResult.legacyExact.length + checkResult.legacyFuzzy.length;
    if (isNewStudent && checkResult.status === 'found' && (liveHits > 0 || legacyHits > 0)) {
      // Gate already handled ASISTS; still confirm if later address-driven live matches appear
      // and the member has not acknowledged a different person.
      if (!siblingAcknowledged && !assistsDifferentPersonAck && !assistsLegacySameAck) {
        setConfirmDupeOpen(true);
        setPendingSubmit(true);
        return;
      }
    }
    doSubmit();
  }

  function resetForm() {
    clearIntakeDraft(draftUserKey);
    setPendingDraft(null);
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
    setCheckResult(emptyCheckResult());
    setSiblingAcknowledged(false);
    resetAssistsGate(false);
    setAssistsQuery('');
    setSavedStudent(null);
    setSavedAsVisit(false);
    setSubmitError('');
    setSelectedExistingStudent(null);
    setPreferredStudentId(null);
    setIntakeAddress({ address: '', apt: '', city: '', state: 'NY', zip: '' });
    setAddressVerification(null);
  }

  const inAppShell = canUseAppShell(session?.user?.role);

  const intakeActions = (showReset: boolean) => (
    <>
      <div className={showReset ? undefined : 'invisible pointer-events-none'} aria-hidden={!showReset}>
        <Button
          variant="outline"
          size={inAppShell ? 'default' : 'sm'}
          onClick={resetForm}
          disabled={submitting || cabinetsLoading || !showReset}
          className="gap-1.5"
          aria-label="Reset intake form"
        >
          <RotateCcw className="h-4 w-4" />
          <span className={inAppShell ? undefined : 'hidden sm:inline'}>Reset</span>
        </Button>
      </div>
      <GoogleTranslate />
    </>
  );

  const intakeKioskBar = (showReset: boolean) => (
    <AppTopBar
      user={session?.user}
      darkMode={darkMode}
      onToggleDarkMode={() => setDarkMode((d) => !d)}
      showMobileNav={false}
      showCommandPalette={false}
      eyebrow="Front desk"
      title="Student Intake"
      subtitle={session?.user?.school || null}
      actions={intakeActions(showReset)}
    />
  );

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
    const showP2gReferral = Boolean(
      ageCheck?.validDob && !ageCheck.eligible && !ageCheck.nearEligible,
    );

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
      <div className={inAppShell
        ? 'flex flex-col items-center justify-center py-8 gap-6'
        : 'min-h-screen bg-gradient-to-b from-emerald-50 via-background to-background dark:from-emerald-950/30 dark:via-background dark:to-background flex flex-col'}
      >
        {!inAppShell && intakeKioskBar(false)}
        <div className={inAppShell ? 'contents' : 'flex-1 flex flex-col items-center justify-center p-6 gap-6'}>
        <div className="flex flex-col items-center gap-3 text-center ui-enter">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 shadow-sm">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <p className="ui-eyebrow text-emerald-700/80 dark:text-emerald-400/80">Intake complete</p>
            <h1 className="ui-page-title text-emerald-900 dark:text-emerald-100">
              {savedAsVisit ? 'Visit logged' : 'Student registered'}
            </h1>
          </div>
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
      </div>
    );
  }

  // ── Copy-to-clipboard message for Data Lead ─────────────────────────────────
  function buildCopyMessage(): string {
    const reviewUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/admin/duplicates`
      : '/admin/duplicates';

    return buildIntakeDuplicateAlertMessage({
      form,
      matches: checkResult,
      address: stackedAddressForAlert(addressVerification?.standardized ?? intakeAddress),
      reportedBy: session?.user?.name || session?.user?.email || null,
      school: session?.user?.school ?? null,
      flaggedDifferentPerson: siblingAcknowledged || assistsDifferentPersonAck,
      reviewUrl,
    });
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

  const liveAssistsHits = checkResult.exact.length + checkResult.fuzzy.length;
  const legacyAssistsHits = checkResult.legacyExact.length + checkResult.legacyFuzzy.length;
  const assistsHasMatches = liveAssistsHits + legacyAssistsHits > 0;

  // Acknowledgements stick even if a later duplicate re-check clears match arrays
  // (e.g. DOB-only ASISTS search → unlock before first/last name are filled).
  const newAssistsUnlocked = form.intakeStudentStatus !== 'NEW' || (
    assistsGateChecked && (
      assistsDifferentPersonAck
      || assistsLegacySameAck
      || (!assistsHasMatches && assistsNotFoundAck)
    )
  );

  const showMainIntakeFields =
    (form.intakeStudentStatus !== 'RETURNING' || !!selectedExistingStudent)
    && newAssistsUnlocked;

  const profileLocked =
    form.intakeStudentStatus === 'RETURNING' && !!selectedExistingStudent;

  const lockedFieldClass = profileLocked ? 'bg-muted/50 cursor-default' : undefined;

  // ── INTAKE FORM ─────────────────────────────────────────────────────────────
  return (
    <div className={inAppShell ? 'space-y-5' : 'min-h-screen bg-gradient-to-b from-muted/40 via-background to-background'}>
      {inAppShell ? (
        <PageIntro
          eyebrow="Front desk"
          title="Student Intake"
          description={
            session?.user?.school
              ? `${session.user.school}. Register new and returning students at the front desk.`
              : 'Register new and returning students at the front desk.'
          }
          icon={<UserPlus className="h-5 w-5 text-primary" />}
          actions={intakeActions(activeTab === 'register')}
        />
      ) : (
        intakeKioskBar(activeTab === 'register')
      )}

      <div className={inAppShell ? 'space-y-5' : 'w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-5'}>
        <IntakeIssuesBanner
          reviewHref="/intake"
          refreshToken={issuesRefresh}
          onFixStudent={issue => setFixTarget({
            id: issue.studentId,
            name: formatFullName(issue),
          })}
        />

        <Tabs value={activeTab} onValueChange={v => setActiveTab(v)} className="space-y-6 ui-enter ui-enter-delay-1">
          <TabsList className="grid w-full grid-cols-2 h-11 p-1 rounded-xl">
            <TabsTrigger value="register" className="gap-2 text-sm rounded-lg">
              <UserPlus className="h-4 w-4" /> Register Student
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2 text-sm rounded-lg">
              <List className="h-4 w-4" /> Intake History
              {historyStudents.length > 0 && activeTab === 'history' && (
                <Badge className="ml-1 h-5 min-w-5 text-xs px-1.5">{historyStudents.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── REGISTER TAB ─────────────────────────────── */}
          <TabsContent value="register" className="space-y-6 mt-0">

        <IntakeMemberGuide />

        {pendingDraft && (
          <Alert className="border-amber-300 bg-amber-50/90 dark:border-amber-800 dark:bg-amber-950/30">
            <Info className="h-4 w-4 text-amber-700 dark:text-amber-400" />
            <AlertTitle className="text-sm text-amber-950 dark:text-amber-100">
              Unfinished intake on this computer
            </AlertTitle>
            <AlertDescription className="text-xs text-amber-900/90 dark:text-amber-100/90 space-y-3">
              <p>
                A draft was saved{pendingDraft.form.firstName || pendingDraft.form.lastName
                  ? ` for ${formatFullName(pendingDraft.form.firstName, pendingDraft.form.lastName)}`
                  : ''}
                {' '}on {formatIntakeDraftSavedAt(pendingDraft.savedAt)}.
                Resume after an idle sign-out, or discard to start fresh.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" className="gap-1.5" onClick={resumePendingDraft}>
                  Resume draft
                </Button>
                <Button type="button" size="sm" variant="outline" className="gap-1.5 bg-background/80" onClick={discardPendingDraft}>
                  Discard
                </Button>
              </div>
            </AlertDescription>
          </Alert>
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

          <IntakeAssistsGate
            intakeStudentStatus={form.intakeStudentStatus}
            assistsQuery={assistsQuery}
            onAssistsQueryChange={onAssistsQueryChange}
            runAssistsGateCheck={runAssistsGateCheck}
            checkResult={checkResult}
            assistsGateChecked={assistsGateChecked}
            assistsHasMatches={assistsHasMatches}
            assistsNotFoundAck={assistsNotFoundAck}
            setAssistsNotFoundAck={setAssistsNotFoundAck}
            assistsDifferentPersonAck={assistsDifferentPersonAck}
            setAssistsDifferentPersonAck={setAssistsDifferentPersonAck}
            assistsLegacySameAck={assistsLegacySameAck}
            setAssistsLegacySameAck={(value) => {
              setAssistsLegacySameAck(value);
              if (!value) setPreferredStudentId(null);
            }}
            setSiblingAcknowledged={setSiblingAcknowledged}
            newAssistsUnlocked={newAssistsUnlocked}
            cabinetMap={cabinetMap}
            drawerMap={drawerMap}
            selectAsReturning={selectAsReturning}
            confirmLegacySamePerson={confirmLegacySamePerson}
            schoolLookup={schoolLookup}
            schoolLookupLoading={schoolLookupLoading}
            schoolLookupDone={schoolLookupDone}
            schoolLookupResults={schoolLookupResults}
            onSchoolLookupChange={(v) => {
              setSchoolLookup(v);
              if (schoolLookupTimeout.current) clearTimeout(schoolLookupTimeout.current);
              schoolLookupTimeout.current = setTimeout(() => runSchoolLookup(v), 350);
            }}
          />

          {/* Duplicate check status (after gate unlock) — full match panel renders under DOB */}
          {newAssistsUnlocked && checkResult.status === 'checking' && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>Checking for existing records and possible siblings…</AlertDescription>
            </Alert>
          )}

          {newAssistsUnlocked && checkResult.status === 'needs_dob' && form.intakeStudentStatus === 'NEW' && (
            <Alert className="border-sky-300 bg-sky-50/90 dark:border-sky-800 dark:bg-sky-950/30">
              <Info className="h-4 w-4 text-sky-700 dark:text-sky-400" />
              <AlertTitle className="text-sky-900 dark:text-sky-100 text-sm">
                Enter date of birth to check duplicates
              </AlertTitle>
              <AlertDescription className="text-xs text-sky-800 dark:text-sky-200">
                Name-only ASISTS search found nothing. After you enter DOB (and address when available),
                we scan this system again for same DOB + similar name or same home address — including
                possible siblings.
              </AlertDescription>
            </Alert>
          )}

          {newAssistsUnlocked && checkResult.status === 'clear' && form.intakeStudentStatus === 'NEW' && form.dob && (
            <Alert className="border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertTitle className="text-green-800 dark:text-green-200">No existing records found</AlertTitle>
              <AlertDescription className="text-green-700 dark:text-green-300">
                This student does not appear in this system (including archived) or the school ASISTS / legacy roster. Safe to register.
                {!intakeAddress.address.trim() && (
                  <span className="block mt-1 text-green-600/90">
                    Tip: add and verify the home address for a stronger duplicate check.
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}

          {form.intakeStudentStatus === 'RETURNING' && (
            <IntakeReturningFinder
              selectedExistingStudent={selectedExistingStudent}
              onSelect={selectAsReturning}
              onClear={() => {
                setSelectedExistingStudent(null);
                setForm(f => ({ ...f, ...emptyReturningVisitFields() }));
              }}
              cabinetMap={cabinetMap}
              drawerMap={drawerMap}
            />
          )}

          {showMainIntakeFields && (
          <>
          <IntakePersonalInfoCard
            form={form}
            setField={setField}
            profileLocked={profileLocked}
            lockedFieldClass={lockedFieldClass}
            intakeDobEval={intakeDobEval}
            beEslAgeCheck={beEslAgeCheck}
            dobBlocksForm={dobBlocksForm}
            newAssistsUnlocked={newAssistsUnlocked}
            checkResult={checkResult}
            assistsLegacySameAck={assistsLegacySameAck}
            assistsDifferentPersonAck={assistsDifferentPersonAck}
            siblingAcknowledged={siblingAcknowledged}
            setSiblingAcknowledged={setSiblingAcknowledged}
            setAssistsDifferentPersonAck={setAssistsDifferentPersonAck}
            selectAsReturning={selectAsReturning}
            dataLead={dataLead}
            copied={copied}
            onCopyAlert={handleCopyMessage}
            alertMessage={buildCopyMessage()}
            cabinetMap={cabinetMap}
            drawerMap={drawerMap}
            dobDuplicatePanelRef={dobDuplicatePanelRef}
            staffName={session?.user?.name}
            school={session?.user?.school}
            intakeAddress={intakeAddress}
            setIntakeAddress={setIntakeAddress}
            addressVerification={addressVerification}
            setAddressVerification={setAddressVerification}
            geoclientConfigured={geoclientConfigured}
          />

          {!dobBlocksForm && form.intakeStudentStatus === 'NEW' && (
            <IntakeDemographicsCard form={form} setField={setField} />
          )}

          {!dobBlocksForm && (
          <>
          <IntakeProgramDetails
            form={form}
            setForm={setForm}
            setField={setField}
            toggleActivity={toggleActivity}
            profileLocked={profileLocked}
            intakeActivityOptions={intakeActivityOptions}
            intakeSessions={intakeSessions}
            sessionTimeFieldErrors={sessionTimeFieldErrors}
          />

          <IntakeFileAssignment
            intakeStudentStatus={form.intakeStudentStatus}
            selectedExistingStudent={selectedExistingStudent}
            cabinets={cabinets}
            cabinetsLoading={cabinetsLoading}
            nextSlot={nextSlot}
          />

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
          </>
          )}

          {submitError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}

          {showMainIntakeFields && !dobBlocksForm && (
          <div className="flex justify-end gap-3 pb-8">
            <Button type="button" variant="outline" onClick={resetForm} disabled={submitting || cabinetsLoading}>
              <RotateCcw className="mr-2 h-4 w-4" /> Clear
            </Button>
            <Button
              type="submit"
              disabled={
                submitting ||
                cabinetsLoading ||
                dobBlocksForm ||
                Boolean(form.dob && intakeDobEval.boundaryError) ||
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
      </div>

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
                : 'We found possible matches in this system and/or the school ASISTS / legacy roster. Are you sure you want to register a new record?'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-52 overflow-y-auto">
            {[
              ...checkResult.exact,
              ...checkResult.fuzzy,
              ...checkResult.legacyExact,
              ...checkResult.legacyFuzzy,
            ].map((s, i) => (
              <div key={s._id || i} className="rounded-md border px-3 py-2 text-sm grid grid-cols-2 gap-1 bg-muted/40">
                <span><strong>Name:</strong> {formatFullName(s)}</span>
                <span><strong>DOB:</strong> {s.dob}</span>
                <span><strong>ID:</strong> <span className="font-mono text-xs">{s.labelId || s.studentId || s.externalId || '—'}</span></span>
                <span><strong>Status:</strong> {s._legacy ? 'ASISTS / Legacy' : (s.status || '—')}</span>
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
