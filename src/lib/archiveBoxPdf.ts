import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import {
  formatBoxCabinetLabel,
  formatStudentLine,
  getBoxPublicUrl,
  type BoxLabelArchive,
  type BoxLabelBox,
  type BoxLabelStudent,
} from '@/lib/boxLabel';

const PAGE_W = 215.9;
const PAGE_H = 279.4;
const MARGIN = 12.7;
const COL_GAP = 8;
const COL_W = (PAGE_W - MARGIN * 2 - COL_GAP) / 2;
const LEFT_X = MARGIN;
const RIGHT_X = MARGIN + COL_W + COL_GAP;
const LIST_START_Y = 26;
const LIST_LINE_H = 2.35;
const LIST_FONT_SIZE = 7;

function sanitizeFilename(label: string) {
  return label.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'archive-box';
}

function truncateLine(doc: jsPDF, text: string, maxWidth: number) {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let trimmed = text;
  while (trimmed.length > 8 && doc.getTextWidth(`${trimmed}…`) > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}…`;
}

function linesPerColumn() {
  return Math.floor((PAGE_H - MARGIN - LIST_START_Y - MARGIN) / LIST_LINE_H);
}

function drawStudentColumns(
  doc: jsPDF,
  students: BoxLabelStudent[],
  globalStartIndex: number,
) {
  doc.setFont('courier', 'normal');
  doc.setFontSize(LIST_FONT_SIZE);

  const mid = Math.ceil(students.length / 2);
  const left = students.slice(0, mid);
  const right = students.slice(mid);

  left.forEach((student, i) => {
    const line = truncateLine(
      doc,
      formatStudentLine(student, globalStartIndex + i),
      COL_W,
    );
    doc.text(line, LEFT_X, LIST_START_Y + i * LIST_LINE_H);
  });

  right.forEach((student, i) => {
    const line = truncateLine(
      doc,
      formatStudentLine(student, globalStartIndex + mid + i),
      COL_W,
    );
    doc.text(line, RIGHT_X, LIST_START_Y + i * LIST_LINE_H);
  });
}

export type ArchiveBoxPdfInput = {
  box: BoxLabelBox;
  archive: BoxLabelArchive;
  students: BoxLabelStudent[];
  origin?: string;
};

export async function buildArchiveBoxPdf({
  box,
  archive,
  students,
  origin,
}: ArchiveBoxPdfInput): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const boxUrl = getBoxPublicUrl(box._id, origin);
  const cabinetLabel = formatBoxCabinetLabel(archive);
  const qrDataUrl = await QRCode.toDataURL(boxUrl, {
    width: 320,
    margin: 1,
    errorCorrectionLevel: 'M',
  });

  // Page 1 — box label + QR
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  const titleLines = doc.splitTextToSize(box.label, PAGE_W - MARGIN * 2);
  doc.text(titleLines, PAGE_W / 2, 22, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  let y = 22 + titleLines.length * 6 + 4;
  const meta = [
    `${cabinetLabel}${archive.school ? ` · ${archive.school}` : ''}`,
    archive.location,
    `${archive.schoolYear}${archive.archiveDate ? ` · Archived ${archive.archiveDate}` : ''}`,
    `${students.length || box.currentCount || 0} student file(s)`,
  ];
  meta.forEach((line) => {
    doc.text(line, PAGE_W / 2, y, { align: 'center', maxWidth: PAGE_W - MARGIN * 2 });
    y += 5.5;
  });

  const qrSize = 42;
  doc.addImage(
    qrDataUrl,
    'PNG',
    (PAGE_W - qrSize) / 2,
    y + 4,
    qrSize,
    qrSize,
  );
  y += qrSize + 10;

  doc.setFontSize(8);
  const urlLines = doc.splitTextToSize(boxUrl, PAGE_W - MARGIN * 2);
  doc.text(urlLines, PAGE_W / 2, y, { align: 'center' });
  y += urlLines.length * 4 + 4;

  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text('Scan to open the public box page and full student list', PAGE_W / 2, y, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(
    'Adult Education Archive · Do not discard before records retention period ends',
    PAGE_W / 2,
    PAGE_H - MARGIN,
    { align: 'center' },
  );
  doc.setTextColor(0, 0, 0);

  // Page 2+ — two-column student list
  if (students.length > 0) {
    const perColumn = linesPerColumn();
    const perPage = perColumn * 2;

    for (let offset = 0; offset < students.length; offset += perPage) {
      doc.addPage();
      const pageStudents = students.slice(offset, offset + perPage);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(`Student files in this box (${students.length})`, MARGIN, 16);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);
      doc.text(box.label, MARGIN, 21);
      doc.setTextColor(0, 0, 0);

      drawStudentColumns(doc, pageStudents, offset);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      const pageNum = Math.floor(offset / perPage) + 2;
      doc.text(`Page ${pageNum}`, PAGE_W - MARGIN, PAGE_H - MARGIN, { align: 'right' });
      doc.setTextColor(0, 0, 0);
    }
  }

  return doc;
}

export async function downloadArchiveBoxPdf(input: ArchiveBoxPdfInput) {
  const doc = await buildArchiveBoxPdf(input);
  const filename = `${sanitizeFilename(input.box.label)}.pdf`;
  doc.save(filename);
}
