/**
 * Public archive-box QR payload.
 * Unauthenticated: the printed box ID is the access key.
 * Do not include DOB or other PII beyond name + filing IDs.
 */

export const PUBLIC_ARCHIVE_BOX_STUDENT_KEYS = [
  '_id',
  'firstName',
  'lastName',
  'labelId',
  'studentId',
] as const;

export type PublicArchiveBoxStudent = {
  _id: string;
  firstName?: string;
  lastName?: string;
  labelId?: string;
  studentId?: string;
};

export const PUBLIC_ARCHIVE_BOX_STUDENT_PROJECTION = {
  firstName: 1,
  lastName: 1,
  labelId: 1,
  studentId: 1,
};

export function toPublicArchiveBoxStudent(doc: Record<string, unknown>): PublicArchiveBoxStudent {
  const payload: PublicArchiveBoxStudent = {
    _id: String(doc._id),
  };
  if (typeof doc.firstName === 'string') payload.firstName = doc.firstName;
  if (typeof doc.lastName === 'string') payload.lastName = doc.lastName;
  if (typeof doc.labelId === 'string') payload.labelId = doc.labelId;
  if (typeof doc.studentId === 'string') payload.studentId = doc.studentId;
  return payload;
}
