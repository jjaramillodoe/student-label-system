/**
 * Public QR student lookup DTO.
 *
 * GET /api/students/lookup is unauthenticated: the printed label ID is the
 * access key. Never spread a MongoDB student document into the response.
 */

export const PUBLIC_STUDENT_LOOKUP_KEYS = [
  '_id',
  'firstName',
  'lastName',
  'labelId',
  'studentId',
  'dob',
  'school',
  'status',
  'program',
  'archived',
  'cabinet',
  'drawer',
  'drawerSection',
  'cabinetName',
  'drawerName',
  'archiveBoxLabel',
  'archiveLocation',
  'archiveSchoolYear',
  'archiveBoxId',
  'siblingFlag',
  'siblingConfirmed',
  'siblings',
] as const;

export type PublicStudentLookupKey = (typeof PUBLIC_STUDENT_LOOKUP_KEYS)[number];

export type PublicSiblingLookup = {
  _id: string;
  firstName?: string;
  lastName?: string;
  labelId?: string;
  studentId?: string;
};

export type PublicStudentLookup = {
  _id: string;
  firstName?: string;
  lastName?: string;
  labelId?: string;
  studentId?: string;
  dob?: string;
  school?: string;
  status?: string;
  program?: string;
  archived?: boolean;
  cabinet?: string;
  drawer?: string;
  drawerSection?: string;
  cabinetName?: string | null;
  drawerName?: string | null;
  archiveBoxLabel?: string | null;
  archiveLocation?: string | null;
  archiveSchoolYear?: string | null;
  archiveBoxId?: string | null;
  siblingFlag?: boolean;
  siblingConfirmed?: boolean;
  siblings: PublicSiblingLookup[];
};

/** Fields fetched from Mongo. `siblingWith` is used to resolve siblings, then dropped. */
export const PUBLIC_STUDENT_LOOKUP_PROJECTION = {
  firstName: 1,
  lastName: 1,
  labelId: 1,
  studentId: 1,
  dob: 1,
  school: 1,
  status: 1,
  program: 1,
  archived: 1,
  cabinet: 1,
  drawer: 1,
  drawerSection: 1,
  archiveBoxLabel: 1,
  archiveLocation: 1,
  archiveSchoolYear: 1,
  archiveBoxId: 1,
  siblingFlag: 1,
  siblingConfirmed: 1,
  siblingWith: 1,
} as const;

function asString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) return value;
  return undefined;
}

function asIdString(value: unknown): string | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && typeof (value as { toString?: () => string }).toString === 'function') {
    const text = (value as { toString: () => string }).toString();
    return text && text !== '[object Object]' ? text : undefined;
  }
  return undefined;
}

function asBool(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

export function toPublicStudentLookup(
  student: Record<string, unknown>,
  extras: {
    cabinetName: string | null;
    drawerName: string | null;
    siblings: PublicSiblingLookup[];
  },
): PublicStudentLookup {
  const payload: PublicStudentLookup = {
    _id: asIdString(student._id) ?? '',
    firstName: asString(student.firstName),
    lastName: asString(student.lastName),
    labelId: asString(student.labelId),
    studentId: asString(student.studentId),
    dob: asString(student.dob),
    school: asString(student.school),
    status: asString(student.status),
    program: asString(student.program),
    archived: asBool(student.archived),
    cabinet: asIdString(student.cabinet),
    drawer: asIdString(student.drawer),
    drawerSection: asString(student.drawerSection),
    cabinetName: extras.cabinetName,
    drawerName: extras.drawerName,
    archiveBoxLabel: asString(student.archiveBoxLabel) ?? null,
    archiveLocation: asString(student.archiveLocation) ?? null,
    archiveSchoolYear: asString(student.archiveSchoolYear) ?? null,
    archiveBoxId: asIdString(student.archiveBoxId) ?? null,
    siblingFlag: asBool(student.siblingFlag),
    siblingConfirmed: asBool(student.siblingConfirmed),
    siblings: extras.siblings,
  };

  return Object.fromEntries(
    PUBLIC_STUDENT_LOOKUP_KEYS.map((key) => [key, payload[key]]),
  ) as PublicStudentLookup;
}
