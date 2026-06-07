import { validateIntakeVisits, type IntakeVisitLike } from '@/lib/intakeVisitValidation';

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

export function detectIntakeIssuesFromStudent(doc: {
  _id?: { toString(): string } | string;
  firstName?: string;
  lastName?: string;
  school?: string;
  labelId?: string;
  createdAt?: string;
  timeIn?: string;
  timeOut?: string | null;
  isLeaving?: string;
  intakeVisits?: IntakeVisitLike[];
}): IntakeIssueStudent | null {
  const visits: IntakeVisitLike[] = Array.isArray(doc.intakeVisits) && doc.intakeVisits.length
    ? doc.intakeVisits
    : doc.timeIn
      ? [{
          date: doc.createdAt,
          timeIn: doc.timeIn,
          timeOut: doc.timeOut ?? null,
          isLeaving: doc.isLeaving,
        }]
      : [];

  if (visits.length < 2) return null;

  const validation = validateIntakeVisits(visits);
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
