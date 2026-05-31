/** Absolute URL for archive box QR codes and printed labels. */
export function getBoxPublicUrl(boxId: string, origin?: string): string {
  const base =
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_APP_URL) ||
    origin ||
    '';
  return `${base}/archive/box/${boxId}`;
}

export type BoxLabelStudent = {
  _id?: string;
  firstName?: string;
  lastName?: string;
  labelId?: string;
  studentId?: string;
  dob?: string;
};

export type BoxLabelArchive = {
  cabinetName: string;
  cabinetIdentifier?: string | null;
  school?: string | null;
  schoolYear: string;
  location: string;
  archiveDate?: string;
};

export type BoxLabelBox = {
  _id: string;
  label: string;
  currentCount?: number;
  maxCapacity?: number;
};

export function formatBoxCabinetLabel(archive: BoxLabelArchive) {
  return archive.cabinetIdentifier
    ? `${archive.cabinetName} (${archive.cabinetIdentifier})`
    : archive.cabinetName;
}

export function formatStudentLine(student: BoxLabelStudent, index: number) {
  const name = `${student.lastName || ''}, ${student.firstName || ''}`.trim().replace(/^,\s*/, '');
  const id = student.labelId || student.studentId || '—';
  return `${String(index + 1).padStart(3, ' ')}. ${name}  ·  ${id}`;
}
