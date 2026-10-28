/**
 * Temporary Data Lead delegation ("Acting Data Lead").
 *
 * A Data Lead asks for one of their school's Data Members to act as Data Lead for a
 * date range (for example while on vacation). An Admin approves or denies the request;
 * a delegation an Admin creates is approved immediately. The user's stored role never
 * changes: their session role is worked out from the approved date range on each
 * request, so access ends on its own after the end date.
 *
 * Dates are whole school days (YYYY-MM-DD, New York time), inclusive on both ends.
 */
import { SCHOOL_INTAKE_TZ } from '@/lib/intakeCalendar';

export const ROLE_DELEGATIONS_COLLECTION = 'role_delegations';
export const DELEGATION_MAX_DAYS = 30;
export const DELEGATE_BASE_ROLE = 'Data Member';
export const DELEGATED_ROLE = 'Data Lead';

export type DelegationStatus = 'pending' | 'approved' | 'denied' | 'revoked';

/** What a viewer sees: approved delegations split into scheduled, active, and expired. */
export type DelegationPhase = 'pending' | 'scheduled' | 'active' | 'expired' | 'denied' | 'revoked';

export type DelegationPerson = { email: string; name: string };

export type DelegationDoc = {
  userId: string;
  userEmail: string;
  userName: string;
  school: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: DelegationStatus;
  requestedBy: DelegationPerson & { role: string };
  requestedAt: string;
  reviewedBy?: DelegationPerson;
  reviewedAt?: string;
  reviewNote?: string;
  revokedBy?: DelegationPerson;
  revokedAt?: string;
};

export type DelegationView = DelegationDoc & { _id: string; phase: DelegationPhase };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Today's date at the schools (New York), as YYYY-MM-DD. */
export function schoolToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SCHOOL_INTAKE_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function dayNumber(date: string): number {
  return Math.round(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
}

function isRealDate(date: unknown): date is string {
  if (typeof date !== 'string' || !DATE_RE.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

/** Inclusive number of days in a range. */
export function delegationDays(startDate: string, endDate: string): number {
  return dayNumber(endDate) - dayNumber(startDate) + 1;
}

export function validateDelegationDates(
  input: { startDate?: unknown; endDate?: unknown },
  now: Date = new Date(),
): { startDate: string; endDate: string } | { error: string } {
  const { startDate, endDate } = input;
  if (!isRealDate(startDate) || !isRealDate(endDate)) {
    return { error: 'Choose a start date and an end date.' };
  }
  if (endDate < startDate) return { error: 'The end date must be on or after the start date.' };
  if (startDate < schoolToday(now)) return { error: 'The start date cannot be in the past.' };
  if (delegationDays(startDate, endDate) > DELEGATION_MAX_DAYS) {
    return { error: `A delegation can last at most ${DELEGATION_MAX_DAYS} days.` };
  }
  return { startDate, endDate };
}

export function delegationPhase(
  d: Pick<DelegationDoc, 'status' | 'startDate' | 'endDate'>,
  now: Date = new Date(),
): DelegationPhase {
  if (d.status !== 'approved') return d.status;
  const today = schoolToday(now);
  if (today < d.startDate) return 'scheduled';
  if (today > d.endDate) return 'expired';
  return 'active';
}

/** Do two inclusive date ranges share at least one day? */
export function rangesOverlap(
  a: { startDate: string; endDate: string },
  b: { startDate: string; endDate: string },
): boolean {
  return a.startDate <= b.endDate && b.startDate <= a.endDate;
}

/** Mongo filter for this user's approved delegation covering today, if any. */
export function activeDelegationFilter(email: string, school: string, now: Date = new Date()) {
  const today = schoolToday(now);
  return {
    userEmail: email.trim().toLowerCase(),
    school,
    status: 'approved' as const,
    startDate: { $lte: today },
    endDate: { $gte: today },
  };
}

/**
 * The role a session should carry. Only a Data Member can be raised, and only while
 * their approved delegation covers today.
 */
export function effectiveRole(
  baseRole: string,
  active: Pick<DelegationDoc, 'status' | 'startDate' | 'endDate'> | null,
  now: Date = new Date(),
): string {
  if (baseRole !== DELEGATE_BASE_ROLE || !active) return baseRole;
  return delegationPhase(active, now) === 'active' ? DELEGATED_ROLE : baseRole;
}

/**
 * Admins and real Data Leads (not acting ones) can ask for and revoke delegations.
 * Data Leads are limited to their own school; only Admins approve or deny.
 */
export function canDelegate(actor: {
  role?: string | null;
  school?: string | null;
  actingDataLeadUntil?: string | null;
}): boolean {
  if (actor.role === 'Admin') return true;
  return actor.role === DELEGATED_ROLE && !actor.actingDataLeadUntil && Boolean(actor.school?.trim());
}

export function formatDelegationDate(date: string): string {
  if (!isRealDate(date)) return date;
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
