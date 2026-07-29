/** Shared Avery Word-doc download for Dashboard, Print Queue, and Intake reprint. */

export type AveryDocxLayout = 'avery5163' | 'avery94205';

export type AveryDocxStudent = {
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

export async function downloadAveryDocx(
  layout: AveryDocxLayout,
  students: AveryDocxStudent[],
): Promise<void> {
  const route = DOCX_ROUTES[layout];
  const res = await fetch(route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ students }),
  });
  if (!res.ok) {
    throw new Error('Failed to generate Word document');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${layout}-labels-${new Date().toISOString().slice(0, 10)}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
