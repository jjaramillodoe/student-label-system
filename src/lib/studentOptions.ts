import { getFiscalYearOptions } from '@/lib/fiscalYear';

/** Enrollment / filing statuses used in student records and filters. */
export const STUDENT_STATUS_OPTIONS = [
  'Active',
  'Inactive',
  'Graduated',
  'Withdrawn',
  'Pending',
  'Transferred',
  'Archived',
  'Other',
] as const;

export type StudentStatus = (typeof STUDENT_STATUS_OPTIONS)[number];

export const INACTIVE_STUDENT_STATUSES = [
  'Inactive',
  'Graduated',
  'Withdrawn',
  'Transferred',
] as const;

export function isStudentStatus(value: string): value is StudentStatus {
  return (STUDENT_STATUS_OPTIONS as readonly string[]).includes(value);
}

/** School-year dropdowns — same window as school config (prior + current + two future). */
export function fiscalYearOptions(anchorDate = new Date()): string[] {
  return getFiscalYearOptions(anchorDate);
}

export const AVERY_LAYOUTS = [
  { key: 'avery5163', name: 'Avery 5163 (2x5 Sheet)', labelsPerSheet: 10 },
  { key: 'avery94205', name: 'Avery 94205 (2x5 Sheet)', labelsPerSheet: 10 },
] as const;

export type AveryLayoutKey = (typeof AVERY_LAYOUTS)[number]['key'];
