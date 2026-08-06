import { formatHumanDate, formatShortDate } from '@/lib/utils';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Earliest accepted birth year on intake (calendar min). */
export const INTAKE_DOB_MIN_YEAR = 1920;
/** Absolute minimum age for adult education enrollment. */
export const INTAKE_MIN_AGE_YEARS = 16;
/** BE / ESL enrollment age (eligible on birthday). */
export const BE_ESL_MIN_AGE_YEARS = 21;
/** Allow form completion when turning 21 within this many days. */
export const BE_ESL_NEAR_ELIGIBLE_DAYS = 42;

export type BeEslAgeCheck = {
  validDob: boolean;
  /** True when already at least BE/ESL minimum age. */
  eligible: boolean;
  /** True when not yet eligible but within the near-eligible window. */
  nearEligible: boolean;
  eligibleOnIso: string | null;
  eligibleOnLabel: string | null;
  daysUntilEligible: number | null;
};

export type IntakeDobEvaluation = {
  validDob: boolean;
  birthYear: number | null;
  ageYears: number | null;
  /** Blocking field error (1920 / under 16 / invalid). */
  boundaryError: string | null;
  beEsl: BeEslAgeCheck & {
    applicable: boolean;
    bannerMessage: string | null;
    ineligibleMessage: string | null;
  };
  /** Hide subsequent form sections / block submit. */
  blocksForm: boolean;
  /** Show near-eligible banner; submit allowed. */
  nearEligible: boolean;
};

function parseIsoDate(value: string): Date | null {
  const match = value.trim().match(ISO_DATE);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (Number.isNaN(date.getTime())) return null;
  if (
    date.getFullYear() !== Number(year)
    || date.getMonth() !== Number(month) - 1
    || date.getDate() !== Number(day)
  ) {
    return null;
  }
  return date;
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Whole years of age as of referenceDate (birthday-aware). */
export function ageInYears(dob: Date, referenceDate: Date = new Date()): number {
  const today = startOfDay(referenceDate);
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
}

/** Minimum age date (eligible on birthday). */
export function getBeEslEligibilityDate(dob: Date, minimumAge: number = BE_ESL_MIN_AGE_YEARS): Date {
  const eligible = new Date(dob.getFullYear(), dob.getMonth(), dob.getDate());
  eligible.setFullYear(eligible.getFullYear() + minimumAge);
  return eligible;
}

export function intakeDobMinIso(): string {
  return `${INTAKE_DOB_MIN_YEAR}-01-01`;
}

export function intakeDobMaxIso(referenceDate: Date = new Date()): string {
  return toIsoDate(startOfDay(referenceDate));
}

export function checkBeEslAgeEligibility(
  dobIso: string,
  minimumAge: number = BE_ESL_MIN_AGE_YEARS,
  referenceDate: Date = new Date(),
  nearEligibleDays: number = BE_ESL_NEAR_ELIGIBLE_DAYS,
): BeEslAgeCheck {
  const dob = parseIsoDate(dobIso);
  if (!dob) {
    return {
      validDob: false,
      eligible: false,
      nearEligible: false,
      eligibleOnIso: null,
      eligibleOnLabel: null,
      daysUntilEligible: null,
    };
  }

  const eligibleOn = getBeEslEligibilityDate(dob, minimumAge);
  const today = startOfDay(referenceDate);
  const eligibleStart = startOfDay(eligibleOn);
  const eligibleOnIso = toIsoDate(eligibleOn);
  const eligibleOnLabel = formatShortDate(eligibleOnIso) || formatHumanDate(eligibleOnIso);

  if (today >= eligibleStart) {
    return {
      validDob: true,
      eligible: true,
      nearEligible: false,
      eligibleOnIso,
      eligibleOnLabel,
      daysUntilEligible: 0,
    };
  }

  const daysUntilEligible = Math.ceil(
    (eligibleStart.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
  );

  return {
    validDob: true,
    eligible: false,
    nearEligible: daysUntilEligible > 0 && daysUntilEligible <= nearEligibleDays,
    eligibleOnIso,
    eligibleOnLabel,
    daysUntilEligible,
  };
}

export function requiresBeEslAgeCheck(input: {
  intakeStudentStatus?: string | null;
  educationStatus?: string | null;
  minimumAge?: number;
}): boolean {
  if (input.intakeStudentStatus === 'Other') return false;
  if (input.educationStatus === 'BE' || input.educationStatus === 'ESL') return true;
  if (input.minimumAge && input.minimumAge < BE_ESL_MIN_AGE_YEARS) return false;
  return Boolean(input.intakeStudentStatus && input.intakeStudentStatus !== 'Other');
}

/** Full intake DOB evaluation: year bound, age 16+, and BE/ESL 21 with 6-week window. */
export function evaluateIntakeDob(
  dobIso: string,
  options?: {
    requiresBeEsl?: boolean;
    referenceDate?: Date;
  },
): IntakeDobEvaluation {
  const referenceDate = options?.referenceDate ?? new Date();
  const requiresBeEsl = options?.requiresBeEsl ?? true;
  const emptyBeEsl = {
    validDob: false,
    eligible: false,
    nearEligible: false,
    eligibleOnIso: null,
    eligibleOnLabel: null,
    daysUntilEligible: null,
    applicable: false,
    bannerMessage: null,
    ineligibleMessage: null,
  };

  const dob = parseIsoDate(dobIso);
  if (!dob) {
    return {
      validDob: false,
      birthYear: null,
      ageYears: null,
      boundaryError: dobIso.trim() ? 'Enter a valid date of birth (MM/DD/YYYY).' : null,
      beEsl: emptyBeEsl,
      blocksForm: Boolean(dobIso.trim()),
      nearEligible: false,
    };
  }

  const birthYear = dob.getFullYear();
  const ageYears = ageInYears(dob, referenceDate);
  const maxIso = intakeDobMaxIso(referenceDate);

  let boundaryError: string | null = null;
  if (birthYear < INTAKE_DOB_MIN_YEAR) {
    boundaryError =
      'Please verify the birth year. Dates before 1920 require administrative confirmation.';
  } else if (toIsoDate(dob) > maxIso) {
    boundaryError = 'Date of birth cannot be in the future.';
  } else if (ageYears < INTAKE_MIN_AGE_YEARS) {
    boundaryError =
      'Applicant must be at least 16 years old to enroll in adult education programs.';
  }

  const beCheck = checkBeEslAgeEligibility(dobIso, BE_ESL_MIN_AGE_YEARS, referenceDate);
  const eligibleDateLabel =
    beCheck.eligibleOnIso
      ? (formatShortDate(beCheck.eligibleOnIso) || formatHumanDate(beCheck.eligibleOnIso) || beCheck.eligibleOnIso)
      : null;

  let bannerMessage: string | null = null;
  let ineligibleMessage: string | null = null;

  if (requiresBeEsl && beCheck.validDob && !boundaryError) {
    if (beCheck.eligible) {
      // no banner
    } else if (beCheck.nearEligible) {
      const days = beCheck.daysUntilEligible ?? 0;
      const dayLabel = days === 1 ? '1 day' : `${days} days`;
      bannerMessage =
        `Student will reach full eligibility on ${eligibleDateLabel} (in ${dayLabel}). ` +
        'You may complete and submit intake now; they become fully eligible for BE/ESL on that date.';
    } else {
      const days = beCheck.daysUntilEligible ?? 0;
      const dayLabel = days === 1 ? '1 day' : `${days} days`;
      ineligibleMessage =
        `Not yet eligible for BE or ESL (must be ${BE_ESL_MIN_AGE_YEARS}). ` +
        `They can re-apply in ${dayLabel} — on ${eligibleDateLabel}. ` +
        'Refer students who need options sooner to Pathways to Graduation (P2G).';
    }
  }

  const nearEligible = Boolean(
    !boundaryError && requiresBeEsl && beCheck.nearEligible,
  );
  const beEslBlocks = Boolean(
    !boundaryError && requiresBeEsl && !beCheck.eligible && !beCheck.nearEligible,
  );
  const blocksForm = Boolean(boundaryError || beEslBlocks);

  return {
    validDob: true,
    birthYear,
    ageYears,
    boundaryError,
    beEsl: {
      ...beCheck,
      applicable: requiresBeEsl,
      bannerMessage,
      ineligibleMessage,
    },
    blocksForm,
    nearEligible,
  };
}

/** True when BE/ESL age rules allow create/update (eligible or near-eligible). */
export function isBeEslAgeAllowed(check: BeEslAgeCheck): boolean {
  return check.validDob && (check.eligible || check.nearEligible);
}

export function beEslAgeErrorMessage(
  check: BeEslAgeCheck,
  minimumAge: number = BE_ESL_MIN_AGE_YEARS,
): string {
  if (!check.validDob) return 'Enter a valid date of birth.';
  if (check.eligible || check.nearEligible) return '';

  const days = check.daysUntilEligible ?? 0;
  const dayLabel = days === 1 ? '1 day' : `${days} days`;
  const eligibleDateLabel = check.eligibleOnIso
    ? formatShortDate(check.eligibleOnIso) || formatHumanDate(check.eligibleOnIso)
    : check.eligibleOnLabel || 'the eligibility date';

  return `Student must be at least ${minimumAge} years old for BE or ESL enrollment. They can register in ${dayLabel} (${eligibleDateLabel}).`;
}

export function beEslAgeHintMessage(
  check: BeEslAgeCheck,
  minimumAge: number = BE_ESL_MIN_AGE_YEARS,
): string {
  if (!check.validDob) {
    return `Students must be at least ${minimumAge} years old to enroll in BE (Basic Education) or ESL.`;
  }
  if (check.eligible) {
    return `Eligible for BE or ESL enrollment (${minimumAge} years old or older).`;
  }
  if (check.nearEligible) {
    const days = check.daysUntilEligible ?? 0;
    const dayLabel = days === 1 ? '1 day' : `${days} days`;
    const eligibleDateLabel = check.eligibleOnIso
      ? formatShortDate(check.eligibleOnIso) || formatHumanDate(check.eligibleOnIso)
      : check.eligibleOnLabel || 'the eligibility date';
    return `Near-eligible: turns ${minimumAge} on ${eligibleDateLabel} (in ${dayLabel}). Intake may continue.`;
  }

  const days = check.daysUntilEligible ?? 0;
  const dayLabel = days === 1 ? '1 day' : `${days} days`;
  const eligibleDateLabel = check.eligibleOnIso
    ? formatShortDate(check.eligibleOnIso) || formatHumanDate(check.eligibleOnIso)
    : check.eligibleOnLabel || 'the eligibility date';

  return `Not yet eligible for BE or ESL (${minimumAge} years old or older). Student can register in ${dayLabel} — on ${eligibleDateLabel}.`;
}

export function buildEligibilityNoticeTicket(input: {
  firstName?: string;
  lastName?: string;
  dobIso: string;
  eligibleOnIso: string | null;
  daysUntilEligible: number | null;
  staffName?: string | null;
  school?: string | null;
}): string {
  const name = [input.firstName, input.lastName].filter(Boolean).join(' ').trim() || '—';
  const dobLabel = formatShortDate(input.dobIso) || input.dobIso;
  const eligibleLabel = input.eligibleOnIso
    ? (formatShortDate(input.eligibleOnIso) || formatHumanDate(input.eligibleOnIso) || input.eligibleOnIso)
    : '—';
  const days = input.daysUntilEligible ?? 0;
  const dayLabel = days === 1 ? '1 day' : `${days} days`;
  const today = formatShortDate(intakeDobMaxIso()) || new Date().toLocaleDateString('en-US');

  return [
    'STUDENT LABEL SYSTEM — ELIGIBILITY NOTICE',
    'NYC DOE Adult Education · District 79',
    '',
    'This student may complete intake now under the near-eligible window',
    `(within ${BE_ESL_NEAR_ELIGIBLE_DAYS} days of turning ${BE_ESL_MIN_AGE_YEARS}).`,
    '',
    `Student name:     ${name}`,
    `Date of birth:    ${dobLabel}`,
    `Full eligibility: ${eligibleLabel}`,
    `Days remaining:   ${dayLabel}`,
    '',
    'They become fully eligible for BE / ESL enrollment on the date above.',
    'Please keep this notice with their paperwork if needed.',
    '',
    `School:           ${input.school || '—'}`,
    `Prepared by:      ${input.staffName || '—'}`,
    `Printed:          ${today}`,
    '',
    'Pathways to Graduation (if needed): https://p2g.nyc/contact/',
  ].join('\n');
}

export function downloadEligibilityNoticeTicket(
  filename: string,
  content: string,
): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
