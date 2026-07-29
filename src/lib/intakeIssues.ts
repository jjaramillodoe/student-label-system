import { validateIntakeVisits, type IntakeVisitLike } from '@/lib/intakeVisitValidation';
import {
  DEFAULT_INTAKE_SESSION_CONFIGS,
  type IntakeSession,
} from '@/lib/intakeSession';

export interface IntakeIssueStudent {
  studentId: string;
  firstName: string;
  lastName: string;
  school?: string;
  labelId?: string;
  visitCount: number;
  flagCount: number;
  dayLabels: string[];
  createdAt?: string;
}

export function resolveSchoolIntakeSessions(
  school: string | undefined,
  schoolMap: Record<string, IntakeSession[]>,
  fallback: IntakeSession[] = DEFAULT_INTAKE_SESSION_CONFIGS,
): IntakeSession[] {
  if (!school?.trim()) return fallback;
  if (schoolMap[school]?.length) return schoolMap[school];
  const match = Object.entries(schoolMap).find(
    ([name]) => name.toLowerCase() === school.toLowerCase(),
  );
  return match?.[1]?.length ? match[1] : fallback;
}

export function detectIntakeIssuesFromStudent(
  doc: {
    _id?: { toString(): string } | string;
    firstName?: string;
    lastName?: string;
    school?: string;
    labelId?: string;
    createdAt?: string;
    timeIn?: string;
    timeOut?: string | null;
    isLeaving?: string;
    intakeSession?: string;
    intakeVisits?: IntakeVisitLike[];
  },
  options?: {
    sessionConfigs?: IntakeSession[];
    schoolSessionMap?: Record<string, IntakeSession[]>;
  },
): IntakeIssueStudent | null {
  const visits: IntakeVisitLike[] = Array.isArray(doc.intakeVisits) && doc.intakeVisits.length
    ? doc.intakeVisits
    : doc.timeIn
      ? [{
          date: doc.createdAt,
          timeIn: doc.timeIn,
          timeOut: doc.timeOut ?? null,
          isLeaving: doc.isLeaving,
          intakeSession: doc.intakeSession,
        }]
      : [];

  if (visits.length === 0) return null;

  const sessionConfigs = options?.sessionConfigs
    ?? resolveSchoolIntakeSessions(doc.school, options?.schoolSessionMap ?? {});

  const validation = validateIntakeVisits(visits, { sessionConfigs });
  if (!validation.hasIssues) return null;

  const id = typeof doc._id === 'string' ? doc._id : doc._id?.toString();
  if (!id) return null;

  return {
    studentId: id,
    firstName: doc.firstName || '',
    lastName: doc.lastName || '',
    school: doc.school,
    labelId: doc.labelId,
    visitCount: visits.length,
    flagCount: validation.flags.length,
    dayLabels: validation.dayIssues.map(d => d.dayLabel),
    createdAt: doc.createdAt,
  };
}
