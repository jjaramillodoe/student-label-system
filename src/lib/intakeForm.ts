import { nowHHMM } from '@/lib/intakeVisitTime';

/** Shared intake form shape (Register Student tab). */
export type IntakeFormState = ReturnType<typeof emptyIntakeForm>;

export function emptyIntakeForm() {
  return {
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
  };
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
