import jsPDF from 'jspdf';

export type DrawerRosterPdfStudent = {
  index: number;
  name: string;
  labelId?: string;
  studentId?: string;
  drawerSection?: string;
  status?: string;
};

export type DrawerRosterPdfInput = {
  cabinetName: string;
  drawerName?: string;
  section?: string;
  students: DrawerRosterPdfStudent[];
};

const PAGE_W = 215.9;
const PAGE_H = 279.4;
const MARGIN = 14;
const ROW_H = 7;
const HEADER_H = 8;

const COLS = [
  { key: '#', width: 10, align: 'right' as const },
  { key: 'Name', width: 62, align: 'left' as const },
  { key: 'Label ID', width: 42, align: 'left' as const },
  { key: 'Section', width: 28, align: 'left' as const },
  { key: 'Status', width: 30, align: 'left' as const },
];

function sanitizeFilename(label: string) {
  return label.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'drawer-roster';
}

function truncate(doc: jsPDF, text: string, maxWidth: number) {
  if (!text) return '—';
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let trimmed = text;
  while (trimmed.length > 2 && doc.getTextWidth(`${trimmed}…`) > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}…`;
}

function locationLabel(input: DrawerRosterPdfInput) {
  return [input.cabinetName, input.drawerName, input.section].filter(Boolean).join(' · ');
}

function drawTableHeader(doc: jsPDF, y: number) {
  doc.setFillColor(241, 245, 249);
  doc.rect(MARGIN, y - 5.5, PAGE_W - MARGIN * 2, HEADER_H, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, y - 5.5, PAGE_W - MARGIN, y - 5.5);
  doc.line(MARGIN, y - 5.5 + HEADER_H, PAGE_W - MARGIN, y - 5.5 + HEADER_H);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  let x = MARGIN + 2;
  for (const col of COLS) {
    const label = col.key;
    if (col.align === 'right') {
      doc.text(label, x + col.width - 2, y, { align: 'right' });
    } else {
      doc.text(label, x, y);
    }
    x += col.width;
  }
  doc.setTextColor(0, 0, 0);
  return y - 5.5 + HEADER_H + 4;
}

function drawRow(doc: jsPDF, student: DrawerRosterPdfStudent, y: number, zebra: boolean) {
  if (zebra) {
    doc.setFillColor(248, 250, 252);
    doc.rect(MARGIN, y - 4.5, PAGE_W - MARGIN * 2, ROW_H, 'F');
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);

  const cells = [
    String(student.index || ''),
    student.name || '—',
    student.labelId || student.studentId || '—',
    student.drawerSection || '—',
    student.status || '—',
  ];

  let x = MARGIN + 2;
  COLS.forEach((col, i) => {
    const maxW = col.width - 4;
    const text = truncate(doc, cells[i], maxW);
    if (col.align === 'right') {
      doc.text(text, x + col.width - 2, y, { align: 'right' });
    } else {
      doc.text(text, x, y);
    }
    x += col.width;
  });
}

function drawPageChrome(
  doc: jsPDF,
  input: DrawerRosterPdfInput,
  pageNum: number,
  totalPages: number,
) {
  const loc = locationLabel(input);
  const printed = new Date().toLocaleString();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('Cabinet Roster', MARGIN, MARGIN + 2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(loc, MARGIN, MARGIN + 9);

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `${input.students.length} student file${input.students.length === 1 ? '' : 's'} · Sorted A–Z by name`,
    MARGIN,
    MARGIN + 15,
  );
  doc.text(`Printed ${printed}`, PAGE_W - MARGIN, MARGIN + 2, { align: 'right' });

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, MARGIN + 18, PAGE_W - MARGIN, MARGIN + 18);

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(
    'NYC Adult Education · Student Label System',
    MARGIN,
    PAGE_H - MARGIN + 2,
  );
  doc.text(`Page ${pageNum} of ${totalPages}`, PAGE_W - MARGIN, PAGE_H - MARGIN + 2, {
    align: 'right',
  });
  doc.setTextColor(0, 0, 0);
}

export function buildDrawerRosterPdf(input: DrawerRosterPdfInput): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const students = [...input.students].sort((a, b) =>
    (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }),
  );

  const firstRowY = MARGIN + 28;
  const usableBottom = PAGE_H - MARGIN - 8;
  const rowsPerPage = Math.max(1, Math.floor((usableBottom - firstRowY) / ROW_H));
  const totalPages = Math.max(1, Math.ceil(students.length / rowsPerPage) || 1);

  if (students.length === 0) {
    drawPageChrome(doc, input, 1, 1);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('No students in this location.', MARGIN, firstRowY);
    return doc;
  }

  for (let page = 0; page < totalPages; page++) {
    if (page > 0) doc.addPage();
    drawPageChrome(doc, input, page + 1, totalPages);

    let y = drawTableHeader(doc, firstRowY);
    const slice = students.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

    slice.forEach((student, i) => {
      drawRow(doc, { ...student, index: student.index || page * rowsPerPage + i + 1 }, y, i % 2 === 1);
      y += ROW_H;
    });

    // Bottom border under last row
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, y - 4.5, PAGE_W - MARGIN, y - 4.5);
  }

  return doc;
}

export function downloadDrawerRosterPdf(input: DrawerRosterPdfInput) {
  const doc = buildDrawerRosterPdf(input);
  const name = sanitizeFilename(locationLabel(input));
  doc.save(`${name}-roster.pdf`);
}
