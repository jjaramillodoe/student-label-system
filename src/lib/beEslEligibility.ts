import { formatHumanDate } from '@/lib/utils';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export type BeEslAgeCheck = {
  validDob: boolean;
  eligible: boolean;
  eligibleOnIso: string | null;
  eligibleOnLabel: string | null;
  daysUntilEligible: number | null;
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

/** Minimum age for BE / ESL intake: 21 years and 1 month. */
export function getBeEslEligibilityDate(dob: Date): Date {
  const eligible = new Date(dob.getFullYear(), dob.getMonth(), dob.getDate());
  eligible.setFullYear(eligible.getFullYear() + 21);
  eligible.setMonth(eligible.getMonth() + 1);
  return eligible;
}

export function checkBeEslAgeEligibility(
  dobIso: string,
  referenceDate: Date = new Date(),
): BeEslAgeCheck {
  const dob = parseIsoDate(dobIso);
  if (!dob) {
    return {
      validDob: false,
      eligible: false,
      eligibleOnIso: null,
      eligibleOnLabel: null,
      daysUntilEligible: null,
    };
  }

  const eligibleOn = getBeEslEligibilityDate(dob);
  const today = startOfDay(referenceDate);
  const eligibleStart = startOfDay(eligibleOn);
  const eligibleOnIso = toIsoDate(eligibleOn);
  const eligibleOnLabel = formatHumanDate(eligibleOnIso);

  if (today >= eligibleStart) {
    return {
      validDob: true,
      eligible: true,
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
    eligibleOnIso,
    eligibleOnLabel,
    daysUntilEligible,
  };
}

export function requiresBeEslAgeCheck(input: {
  intakeStudentStatus?: string | null;
  educationStatus?: string | null;
}): boolean {
  if (input.intakeStudentStatus === 'Other') return false;
  if (input.educationStatus === 'BE' || input.educationStatus === 'ESL') return true;
  return Boolean(input.intakeStudentStatus && input.intakeStudentStatus !== 'Other');
}

export function beEslAgeErrorMessage(check: BeEslAgeCheck): string {
  if (!check.validDob) return 'Enter a valid date of birth.';
  if (check.eligible) return '';

  const days = check.daysUntilEligible ?? 0;
  const dayLabel = days === 1 ? '1 day' : `${days} days`;
  const eligibleLabel = check.eligibleOnLabel || check.eligibleOnIso || 'the eligibility date';

  return `Student must be at least 21 years and 1 month old for BE or ESL enrollment. They can register in ${dayLabel} (${eligibleLabel}).`;
}

export function beEslAgeHintMessage(check: BeEslAgeCheck): string {
  if (!check.validDob) {
    return 'Students must be at least 21 years and 1 month old to enroll in BE (Basic Education) or ESL.';
  }
  if (check.eligible) {
    return 'Eligible for BE or ESL enrollment (21 years and 1 month or older).';
  }

  const days = check.daysUntilEligible ?? 0;
  const dayLabel = days === 1 ? '1 day' : `${days} days`;
  const eligibleLabel = check.eligibleOnLabel || check.eligibleOnIso || 'the eligibility date';

  return `Not yet eligible for BE or ESL. Student can register in ${dayLabel} — on ${eligibleLabel}.`;
}
