export interface SyncIntakeVisitDto {
  visitDate: string | null;
  timeIn: string | null;
  timeOut: string | null;
  isLeaving: string | null;
  intakeSession: string | null;
  intakeActivity: string[];
  durationMinutes: number | null;
  recordedByEmail: string | null;
  recordedByName: string | null;
  sourceVisitIndex: number;
}

export interface SyncStudentDto {
  studentId: string | null;
  labelId: string | null;
  firstName: string | null;
  lastName: string | null;
  dob: string | null;
  email: string | null;
  phone: string | null;
  gender: string | null;
  school: string | null;
  agencyId: string | null;
  fiscalYear: string | null;
  status: string | null;
  program: string | null;
  startDate: string | null;
  endDate: string | null;
  archived: boolean;
  intakeStudentStatus: string | null;
  educationStatus: string | null;
  placementClass: string | null;
  notes: string | null;
  siblingFlag: boolean;
  intakeVisits: SyncIntakeVisitDto[];
  sourceMongoId: string;
  sourceLastModified: string;
}

export function getSourceLastModified(doc: {
  updatedAt?: string | null;
  createdAt?: string | null;
}): string {
  return doc.updatedAt || doc.createdAt || new Date(0).toISOString();
}

export function toSyncStudentDto(doc: Record<string, unknown>): SyncStudentDto {
  const intakeVisits = Array.isArray(doc.intakeVisits)
    ? doc.intakeVisits.map((visit, index) => {
        const v = (visit ?? {}) as Record<string, unknown>;
        const recordedBy = (v.recordedBy ?? {}) as Record<string, unknown>;
        return {
          visitDate: typeof v.date === 'string' ? v.date : null,
          timeIn: typeof v.timeIn === 'string' ? v.timeIn : null,
          timeOut: typeof v.timeOut === 'string' ? v.timeOut : null,
          isLeaving: typeof v.isLeaving === 'string' ? v.isLeaving : null,
          intakeSession: typeof v.intakeSession === 'string' ? v.intakeSession : null,
          intakeActivity: Array.isArray(v.intakeActivity)
            ? v.intakeActivity.filter((item): item is string => typeof item === 'string')
            : [],
          durationMinutes: typeof v.durationMinutes === 'number' ? v.durationMinutes : null,
          recordedByEmail: typeof recordedBy.email === 'string' ? recordedBy.email : null,
          recordedByName: typeof recordedBy.name === 'string' ? recordedBy.name : null,
          sourceVisitIndex: index,
        };
      })
    : [];

  return {
    studentId: typeof doc.studentId === 'string' ? doc.studentId : null,
    labelId: typeof doc.labelId === 'string' ? doc.labelId : null,
    firstName: typeof doc.firstName === 'string' ? doc.firstName : null,
    lastName: typeof doc.lastName === 'string' ? doc.lastName : null,
    dob: typeof doc.dob === 'string' ? doc.dob : null,
    email: typeof doc.email === 'string' ? doc.email : null,
    phone: typeof doc.phone === 'string' ? doc.phone : null,
    gender: typeof doc.gender === 'string' ? doc.gender : null,
    school: typeof doc.school === 'string' ? doc.school : null,
    agencyId: typeof doc.agencyId === 'string' ? doc.agencyId : null,
    fiscalYear: typeof doc.fiscalYear === 'string' ? doc.fiscalYear : null,
    status: typeof doc.status === 'string' ? doc.status : null,
    program: typeof doc.program === 'string' ? doc.program : null,
    startDate: typeof doc.startDate === 'string' ? doc.startDate : null,
    endDate: typeof doc.endDate === 'string' ? doc.endDate : null,
    archived: doc.archived === true,
    intakeStudentStatus:
      typeof doc.intakeStudentStatus === 'string' ? doc.intakeStudentStatus : null,
    educationStatus: typeof doc.educationStatus === 'string' ? doc.educationStatus : null,
    placementClass: typeof doc.placementClass === 'string' ? doc.placementClass : null,
    notes: typeof doc.notes === 'string' ? doc.notes : null,
    siblingFlag: doc.siblingFlag === true,
    intakeVisits,
    sourceMongoId: String(doc._id),
    sourceLastModified: getSourceLastModified({
      updatedAt: typeof doc.updatedAt === 'string' ? doc.updatedAt : null,
      createdAt: typeof doc.createdAt === 'string' ? doc.createdAt : null,
    }),
  };
}

export function buildDeltaSinceQuery(since: string): Record<string, unknown> {
  return {
    $or: [
      { updatedAt: { $gte: since } },
      {
        $and: [
          { $or: [{ updatedAt: { $exists: false } }, { updatedAt: null }] },
          { createdAt: { $gte: since } },
        ],
      },
    ],
  };
}

export interface SyncCursorPayload {
  sourceLastModified: string;
  sourceMongoId: string;
}

export function encodeSyncCursor(payload: SyncCursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeSyncCursor(cursor: string): SyncCursorPayload | null {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as SyncCursorPayload;
    if (!parsed?.sourceLastModified || !parsed?.sourceMongoId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function buildCursorQuery(
  since: string,
  cursor: SyncCursorPayload
): Record<string, unknown> {
  const { sourceLastModified, sourceMongoId } = cursor;

  return {
    $and: [
      buildDeltaSinceQuery(since),
      {
        $or: [
          { updatedAt: { $gt: sourceLastModified } },
          { updatedAt: sourceLastModified, _id: { $gt: sourceMongoId } },
          {
            $and: [
              { $or: [{ updatedAt: { $exists: false } }, { updatedAt: null }] },
              { createdAt: { $gt: sourceLastModified } },
            ],
          },
          {
            $and: [
              { $or: [{ updatedAt: { $exists: false } }, { updatedAt: null }] },
              { createdAt: sourceLastModified },
              { _id: { $gt: sourceMongoId } },
            ],
          },
        ],
      },
    ],
  };
}
