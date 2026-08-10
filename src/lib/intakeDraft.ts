import type { IntakeFormState } from '@/lib/intakeForm';
import type { IntakeAddressValues, IntakeAddressVerification } from '@/components/IntakeAddressFields';

const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
const STORAGE_PREFIX = 'intake-draft:v1:';

export type IntakeDraftPayload = {
  savedAt: number;
  form: IntakeFormState;
  intakeAddress: IntakeAddressValues;
  addressVerification: IntakeAddressVerification | null;
  assistsQuery: string;
  assistsGateChecked: boolean;
  assistsNotFoundAck: boolean;
  assistsDifferentPersonAck: boolean;
  assistsLegacySameAck: boolean;
  /** ASISTS/legacy externalId preserved for NEW registration studentId */
  preferredStudentId?: string | null;
  siblingAcknowledged: boolean;
  selectedExistingStudent: {
    _id?: string;
    firstName?: string;
    lastName?: string;
    dob?: string;
    labelId?: string;
    studentId?: string;
    status?: string;
    archived?: boolean;
    cabinet?: string;
    drawer?: string;
    archiveBoxId?: string;
    archiveBoxLabel?: string;
    archiveLocation?: string;
    archiveSchoolYear?: string;
    intakeVisits?: unknown[];
    phone?: string;
    email?: string;
    address?: string;
    apt?: string;
    city?: string;
    state?: string;
    zip?: string;
    originalStartDate?: string;
  } | null;
};

function storageKey(userKey: string): string {
  return `${STORAGE_PREFIX}${userKey}`;
}

/** Prefer email; fall back to school+name so drafts stay per-staff on shared PCs. */
export function intakeDraftUserKey(user?: {
  email?: string | null;
  school?: string | null;
  name?: string | null;
} | null): string | null {
  const email = user?.email?.trim().toLowerCase();
  if (email) return email;
  const school = user?.school?.trim() || 'school';
  const name = user?.name?.trim() || 'staff';
  if (!user) return null;
  return `${school}:${name}`.toLowerCase();
}

export function hasMeaningfulIntakeDraft(draft: Pick<IntakeDraftPayload, 'form' | 'assistsQuery' | 'selectedExistingStudent' | 'intakeAddress'>): boolean {
  const f = draft.form;
  if (f.firstName?.trim() || f.lastName?.trim() || f.dob?.trim()) return true;
  if (draft.assistsQuery?.trim()) return true;
  if (draft.selectedExistingStudent?._id) return true;
  if (draft.intakeAddress?.address?.trim()) return true;
  if (f.otherNote?.trim() || f.notes?.trim()) return true;
  if (f.intakeActivity?.length) return true;
  if (f.educationStatus || f.intakeSession) return true;
  return false;
}

export function loadIntakeDraft(userKey: string | null): IntakeDraftPayload | null {
  if (!userKey || typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey(userKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as IntakeDraftPayload;
    if (!parsed?.savedAt || !parsed?.form) {
      localStorage.removeItem(storageKey(userKey));
      return null;
    }
    if (Date.now() - parsed.savedAt > DRAFT_TTL_MS) {
      localStorage.removeItem(storageKey(userKey));
      return null;
    }
    if (!hasMeaningfulIntakeDraft(parsed)) {
      localStorage.removeItem(storageKey(userKey));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveIntakeDraft(userKey: string | null, draft: Omit<IntakeDraftPayload, 'savedAt'>): void {
  if (!userKey || typeof window === 'undefined') return;
  if (!hasMeaningfulIntakeDraft(draft)) {
    clearIntakeDraft(userKey);
    return;
  }
  try {
    const payload: IntakeDraftPayload = { ...draft, savedAt: Date.now() };
    localStorage.setItem(storageKey(userKey), JSON.stringify(payload));
  } catch {
    // quota / private mode — ignore
  }
}

export function clearIntakeDraft(userKey: string | null): void {
  if (!userKey || typeof window === 'undefined') return;
  try {
    localStorage.removeItem(storageKey(userKey));
  } catch {
    // ignore
  }
}

export function formatIntakeDraftSavedAt(savedAt: number): string {
  try {
    return new Date(savedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return 'earlier';
  }
}
