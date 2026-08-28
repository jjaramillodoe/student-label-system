import { emptyBarrierAnswers, normalizeBarrierAnswer, normalizeMiddleInitial, normalizeRaceIdentities, INTAKE_BARRIERS } from '@/lib/intakeDemographics';
import { nowHHMM } from '@/lib/intakeVisitTime';

/** Shared intake form shape (Register Student tab). */
export type IntakeFormState = ReturnType<typeof emptyIntakeForm>;

export type IntakeFieldSetter = <K extends keyof IntakeFormState>(
  key: K,
  value: IntakeFormState[K],
) => void;

export function emptyIntakeForm() {
  return {
    // Identity
    firstName: '',
    lastName: '',
    middleInitial: '',
    dob: '',
    homePhone: '',
    cellPhone: '',
    homePhoneSameAsCell: false,
    /** Alias of homePhone — kept so drafts and older UI keep working. */
    phone: '',
    email: '',
    emergencyContactNameRelationship: '',
    emergencyContactPhone: '',
    address: '',
    city: '',
    state: 'NY',
    zip: '',
    // Intake type
    intakeStudentStatus: 'NEW',
    otherNote: '',
    // NEW-specific
    gender: '', // M | F
    startDate: new Date().toISOString().split('T')[0],
    // RETURNING / CTE / Continuing-specific
    originalStartDate: '',
    // Shared intake fields
    educationStatus: '', // BE | ESL
    intakeActivity: [] as string[],
    placementClass: '',
    intakeSession: '',
    timeIn: nowHHMM(),
    isLeaving: '', // Leaving | Staying
    timeOut: '',
    // File assignment
    cabinet: '',
    drawer: '',
    // Misc
    notes: '',
    // ISRF demographics (NEW registrations)
    employmentStatus: '',
    hispanicLatinoOrigin: '',
    raceIdentities: [] as string[],
    ...emptyBarrierAnswers(),
  };
}

/** Merge a saved draft / partial record onto the current form defaults. */
export function hydrateIntakeForm(raw?: Partial<IntakeFormState> | null): IntakeFormState {
  const base = emptyIntakeForm();
  if (!raw) return base;
  const merged: IntakeFormState = { ...base, ...raw };
  if (!merged.homePhone && merged.phone) merged.homePhone = merged.phone;
  if (!merged.phone && merged.homePhone) merged.phone = merged.homePhone;
  merged.middleInitial = normalizeMiddleInitial(merged.middleInitial);
  merged.raceIdentities = normalizeRaceIdentities(merged.raceIdentities);
  merged.homePhoneSameAsCell = Boolean(merged.homePhoneSameAsCell);
  if (merged.homePhoneSameAsCell && merged.cellPhone) {
    merged.homePhone = merged.cellPhone;
    merged.phone = merged.cellPhone;
  }
  for (const barrier of INTAKE_BARRIERS) {
    merged[barrier.key] = normalizeBarrierAnswer(merged[barrier.key]);
  }
  return merged;
}

export type IntakeCheckResult = {
  /** needs_dob: unlocked NEW intake waiting on DOB for the full duplicate/sibling scan */
  status: 'idle' | 'checking' | 'found' | 'clear' | 'needs_dob';
  exact: any[];
  fuzzy: any[];
  legacyExact: any[];
  legacyFuzzy: any[];
};

export function emptyIntakeCheckResult(): IntakeCheckResult {
  return {
    status: 'idle',
    exact: [],
    fuzzy: [],
    legacyExact: [],
    legacyFuzzy: [],
  };
}
