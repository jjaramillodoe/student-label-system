/** Shared Avery Word-doc download for Dashboard, Print Queue, and Intake reprint. */

export type AveryDocxLayout = 'avery5163' | 'avery94205';

export type AveryDocxStudent = {
  _id?: string;
  firstName?: string;
  lastName?: string;
  dob?: string;
  labelId?: string;
  studentId?: string;
  cabinet?: string;
  drawer?: string;
  school?: string;
};

const DOCX_ROUTES: Record<AveryDocxLayout, string> = {
  avery5163: '/api/print/avery5163-docx',
  avery94205: '/api/print/avery94205-docx',
};

export function isAveryDocxLayout(layout: string): layout is AveryDocxLayout {
  return layout === 'avery5163' || layout === 'avery94205';
}

export type DownloadAveryDocxOptions = {
  /**
   * When true, skip print-history + stock consume on the DOCX route.
   * Use when the UI will ask “Did labels print?” before recording.
   */
  skipStock?: boolean;
};

function studentMongoId(student: AveryDocxStudent): string | null {
  const id = typeof student._id === 'string' ? student._id.trim() : '';
  return /^[a-f\d]{24}$/i.test(id) ? id : null;
}

export async function downloadAveryDocx(
  layout: AveryDocxLayout,
  students: AveryDocxStudent[],
  options: DownloadAveryDocxOptions = {},
): Promise<void> {
  const ids = students.map(studentMongoId);
  if (ids.some((id) => !id)) {
    throw new Error('Each student needs a database id to print');
  }

  const route = DOCX_ROUTES[layout];
  const res = await fetch(route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ids,
      skipStock: options.skipStock === true,
    }),
  });
  if (!res.ok) {
    let message = 'Failed to generate Word document';
    try {
      const data = await res.json();
      if (data && typeof data.error === 'string') message = data.error;
    } catch {
      // keep default
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${layout}-labels-${new Date().toISOString().slice(0, 10)}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
