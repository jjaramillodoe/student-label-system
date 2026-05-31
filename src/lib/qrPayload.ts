import { getBoxPublicUrl } from '@/lib/boxLabel';

type StudentQrData = {
  studentId?: string;
  firstName?: string;
  lastName?: string;
  dob?: string;
  cabinet?: string;
  drawer?: string;
  school?: string;
};

/**
 * Encodes a URL to the student details page.
 * Scanning with a phone camera opens the details page directly.
 */
export function buildStudentQrPayload({ studentId }: Pick<StudentQrData, 'studentId'>) {
  const id = studentId || 'N/A';
  const base =
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_APP_URL) || '';
  return `${base}/student/${id}`;
}

/** QR payload for a physical archive box label (public page). */
export function buildBoxQrPayload(boxId: string) {
  return getBoxPublicUrl(boxId);
}

export function extractStudentIdFromQrPayload(value: string) {
  const trimmed = value.trim();

  const urlMatch = trimmed.match(/\/student\/([^\s/?#]+)/);
  if (urlMatch?.[1]) return urlMatch[1];

  const textMatch = trimmed.match(/Student ID:\s*([^\n\r]+)/i);
  if (textMatch?.[1]) return textMatch[1].trim();

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed?.studentId) return String(parsed.studentId).trim();
  } catch {
    // Plain student ID barcodes are still valid
  }

  return trimmed;
}
