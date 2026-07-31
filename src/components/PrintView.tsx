'use client';

import { useEffect, useState } from 'react';
import Barcode from 'react-barcode';
import QRCode from './QRCode';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { FileText, Loader2, Printer, X } from 'lucide-react';
import { buildStudentQrPayload } from '@/lib/qrPayload';
import Avery5163LabelContent from '@/components/Avery5163LabelContent';
import Avery94205LabelContent from '@/components/Avery94205LabelContent';
import AveryPrintGuidance from '@/components/AveryPrintGuidance';
import { AVERY94205 } from '@/lib/avery94205Geometry';
import { downloadAveryDocx, isAveryDocxLayout } from '@/lib/downloadAveryDocx';
import { formatFullName, labelSequenceAtIndex } from '@/lib/personName';

// Avery 5163 on Letter paper (8.5" × 11"):
// 2 cols × 5 rows = 10 labels, each 4" wide × 2" tall
// Top/bottom margin: 0.5"  →  0.5 + 5×2 + 0.5 = 11" ✓
// Left/right margin: 0.1875"  →  0.1875 + 4 + 0.125 gap + 4 + 0.1875 = 8.5" ✓
const AVERY5163 = {
  pageW:      8.5,
  pageH:      11,       // Letter, NOT Legal
  marginTop:  0.5,
  marginSide: 0.1875,
  colGap:     0.125,    // gap between the two columns
  labelW:     4,
  labelH:     2,        // official 2" height
  cols:       2,
  rows:       5,
};

const AVERY_WORD_TEMPLATES: Array<{
  key: string;
  name: string;
  cols: number;
  rows: number;
  width: number;
  height: number;
  printer?: string;
  continuous?: boolean;
}> = [
  { key: 'avery5163', name: 'Avery 5163 (2×5 — Letter 8.5"×11")', cols: AVERY5163.cols, rows: AVERY5163.rows, width: AVERY5163.labelW, height: AVERY5163.labelH },
  { key: 'avery94205', name: 'Avery 94205 (2×5 — 1.5"×3.75")', cols: AVERY94205.cols, rows: AVERY94205.rows, width: AVERY94205.labelW, height: AVERY94205.labelH },
];

const OTHER_TEMPLATES: Array<{
  key: string;
  name: string;
  cols: number;
  rows: number;
  width: number;
  height: number;
  printer?: string;
  continuous?: boolean;
}> = [
  { key: 'avery5160', name: 'Avery 5160 (3x10 Sheet)', cols: 3, rows: 10, width: 2.625, height: 1 },
  { key: 'brother1201', name: 'Brother DK-1201 (1.1" x 3.5")', cols: 1, rows: 1, width: 3.5, height: 1.1, printer: 'QL-800', continuous: true },
  { key: 'brother11208', name: 'Brother DK-11208 (1.1" x 2.1")', cols: 1, rows: 1, width: 2.1, height: 1.1, printer: 'QL-800', continuous: true },
  { key: 'brother2205', name: 'Brother DK-2205 (2.1" x 2.1")', cols: 1, rows: 1, width: 2.1, height: 2.1, printer: 'QL-800', continuous: true },
  { key: 'brother22208', name: 'Brother DK-22208 (2.1" x 2.8")', cols: 1, rows: 1, width: 2.8, height: 2.1, printer: 'QL-800', continuous: true },
];

const LABEL_TEMPLATES = [...AVERY_WORD_TEMPLATES, ...OTHER_TEMPLATES];

function LayoutSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (layout: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="border p-2 rounded focus:outline-blue-400 focus:ring-2 text-sm"
    >
      <optgroup label="Avery — Download Word Doc">
        {AVERY_WORD_TEMPLATES.map(t => (
          <option key={t.key} value={t.key}>{t.name}</option>
        ))}
      </optgroup>
      <optgroup label="Other — Browser print">
        {OTHER_TEMPLATES.map(t => (
          <option key={t.key} value={t.key}>{t.name}</option>
        ))}
      </optgroup>
    </select>
  );
}

interface Student {
  _id?: string;
  firstName: string;
  lastName: string;
  dob: string;
  /** Barcode printed on the physical label: {year}-{initials}-{counter} */
  labelId?: string;
  /** Demographic ID: {LASTNAME}{FIRSTNAME}{AGENCYID}{DOBDIGITS} */
  studentId?: string;
  cabinet?: string;
  drawer?: string;
  school?: string;
}

interface PrintViewProps {
  students: Student[];
  printLayout: string;
  onPrintLayoutChange: (layout: string) => void;
  showQRCode: boolean;
  cabinetMap?: Record<string, string>;
  drawerMap?: Record<string, string>;
  onClose: () => void;
}

export default function PrintView({
  students,
  printLayout,
  onPrintLayoutChange,
  showQRCode,
  cabinetMap = {},
  drawerMap = {},
  onClose,
}: PrintViewProps) {
  const [downloadingDocx, setDownloadingDocx] = useState(false);

  async function recordBrowserPrintJob() {
    try {
      await fetch('/api/print-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          students: students.map((s) => ({
            studentId: s.studentId,
            labelId: s.labelId,
            firstName: s.firstName,
            lastName: s.lastName,
            dob: s.dob,
            school: s.school,
          })),
          labelCount: students.length,
          layout: printLayout,
          status: 'completed',
          consumeStock: true,
        }),
      });
    } catch (err) {
      console.error('Failed to record print / stock usage', err);
    }
  }

  async function handleDownloadDocx() {
    if (!isAveryDocxLayout(printLayout)) return;

    setDownloadingDocx(true);
    try {
      // DOCX routes record print history + decrement stock on success
      await downloadAveryDocx(printLayout, students);
    } catch {
      alert('Error generating Word document. Please try again.');
    } finally {
      setDownloadingDocx(false);
    }
  }

  // Inject @page CSS for the active layout so the browser doesn't scale/shrink the sheet
  useEffect(() => {
    const styleId = 'print-view-page-style';
    let existing = document.getElementById(styleId);
    if (existing) existing.remove();

    const style = document.createElement('style');
    style.id = styleId;

    if (printLayout === 'avery5163') {
      // 8.5" × 11" Letter — MUST match AVERY5163.pageW / pageH exactly
      style.textContent = `
        @media print {
          @page {
            size: 8.5in 11in;
            margin: 0;
          }
          body * { visibility: hidden !important; }
          .avery5163-page, .avery5163-page * { visibility: visible !important; }
          .avery5163-page {
            margin: 0 !important;
            box-shadow: none !important;
          }
        }
      `;
    } else if (printLayout === 'avery94205') {
      style.textContent = `
        @media print {
          @page {
            size: 8.5in 11in;
            margin: 0;
          }
          body * { visibility: hidden !important; }
          .avery94205-page, .avery94205-page * { visibility: visible !important; }
          .avery94205-page {
            margin: 0 !important;
            box-shadow: none !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `;
    } else if (printLayout === 'avery5160') {
      style.textContent = `
        @media print {
          @page { size: 8.5in 11in; margin: 0; }
        }
      `;
    } else {
      style.textContent = `
        @media print {
          @page { size: auto; margin: 0.25in; }
        }
      `;
    }

    document.head.appendChild(style);
    return () => { style.remove(); };
  }, [printLayout]);

  const handlePrint = () => {
    const template = LABEL_TEMPLATES.find(t => t.key === printLayout);
    if (template?.printer === 'QL-800') {
      const confirmed = confirm(
        'Brother QL-800 Print Settings:\n\n' +
        '1. Select your Brother QL-800 printer\n' +
        '2. Set Paper Size: Custom (' + template.width + '" x ' + template.height + '")\n' +
        '3. Set Margins: None (0mm)\n' +
        '4. Set Scale: 100%\n' +
        '5. Enable Background Graphics\n\n' +
        'Click OK to continue printing...'
      );
      if (!confirmed) return;
    }
    // Browser print (Avery 5160 / Brother): record job + decrement stock
    void recordBrowserPrintJob();
    window.print();
  };

  const template = LABEL_TEMPLATES.find(t => t.key === printLayout) || LABEL_TEMPLATES.find(t => t.key === 'avery5163')!;
  const width = template.width;
  const height = template.height;
  const cols = template.cols;
  const rows = template.rows;
  const isBrotherLabel = template.printer === 'QL-800' || printLayout.startsWith('brother');
  // labelId is the barcode on the physical label; fall back to studentId for older records
  const getLabelId = (student: Student) => student.labelId || student.studentId || '';
  const getQrPayload = (student: Student) => buildStudentQrPayload({ studentId: getLabelId(student) });

  const labelStyle = {
    width: `${width}in`,
    height: `${height}in`,
    boxSizing: 'border-box' as const,
    pageBreakInside: 'avoid' as const,
    breakInside: 'avoid' as const,
    border: '2px dashed #888',
    margin: isBrotherLabel ? '0' : '0 auto',
    background: 'white',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.1in',
    ...(isBrotherLabel && {
      pageBreakAfter: 'always' as const,
      pageBreakBefore: 'always' as const,
    }),
  };

  // For Brother continuous feed labels, stack vertically
  if (isBrotherLabel) {
    return (
      <div className="fixed inset-0 bg-white dark:bg-gray-900 z-50 p-8 overflow-auto print:p-0">
        <div className="print:hidden flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
          <div className="flex items-center gap-2">
            <Label>Label Layout:</Label>
            <LayoutSelect value={printLayout} onChange={onPrintLayoutChange} />
            {template.printer === 'QL-800' && (
              <div className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">
                Brother QL-800 — use browser Print
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={handlePrint} className="gap-2">
              <Printer size={16} /> Print
            </Button>
            <Button variant="outline" onClick={onClose} className="gap-2">
              <X size={16} /> Close
            </Button>
          </div>
        </div>
        <div className="w-full flex flex-col gap-0 print:gap-0">
          {students.map((student, idx) => (
            <div
              key={idx}
              style={{
                ...labelStyle,
                border: 'none',
                width: `${width}in`,
                height: `${height}in`,
                margin: '0',
                padding: '0.08in',
              }}
              className="brother-label"
            >
              <div className="font-bold text-base text-center w-full truncate mb-0.5">
                {formatFullName(student)}
              </div>
              <div className="text-[11px] text-center w-full truncate mb-0.5">DOB: {student.dob}</div>
              {getLabelId(student) && (
                <div className="w-full flex flex-col items-center justify-center">
                  <Barcode value={getLabelId(student)} width={1.5} height={22} fontSize={8} margin={0} />
                  <QRCode value={getQrPayload(student)} size={200} level="M" containerStyle={{ width: '0.6in', height: '0.6in' }} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // For sheet-based labels (Avery, etc.)
  let gridStudents = students;
  if (printLayout === 'avery5160') {
    const total = cols * rows;
    gridStudents = [...students];
    while (gridStudents.length < total) gridStudents.push({} as any);
  }

  if (printLayout === 'avery5163') {
    // Pad to fill a full sheet (10 labels)
    const sheetStudents = [...students];
    while (sheetStudents.length % 10 !== 0) sheetStudents.push({} as Student);

    return (
      <div className="fixed inset-0 bg-gray-100 dark:bg-gray-900 z-50 overflow-auto print:overflow-hidden print:bg-white">
        {/* Screen-only toolbar */}
        <div className="print:hidden bg-white dark:bg-gray-800 border-b px-6 py-3 flex flex-col sm:flex-row justify-between items-center gap-3 shadow-sm">
          <div className="flex items-center gap-3 flex-wrap">
            <Label>Label Layout:</Label>
            <LayoutSelect value={printLayout} onChange={onPrintLayoutChange} />
            <AveryPrintGuidance layout="avery5163" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={handleDownloadDocx}
              disabled={downloadingDocx}
              variant="outline"
              className="gap-2 border-blue-400 text-blue-700 hover:bg-blue-50"
            >
              {downloadingDocx
                ? <Loader2 size={16} className="animate-spin" />
                : <FileText size={16} />
              }
              {downloadingDocx ? 'Generating…' : 'Download Word Doc'}
            </Button>
            <Button variant="outline" onClick={onClose} className="gap-2">
              <X size={16} /> Close
            </Button>
          </div>
        </div>

        {/* Sheet preview — one physical page per 10 labels */}
        {Array.from({ length: Math.ceil(sheetStudents.length / 10) }).map((_, pageIdx) => {
          const pageLabels = sheetStudents.slice(pageIdx * 10, pageIdx * 10 + 10);
          return (
            <div
              key={pageIdx}
              className="avery5163-page"
              style={{
                width:       `${AVERY5163.pageW}in`,
                height:      `${AVERY5163.pageH}in`,
                paddingTop:  `${AVERY5163.marginTop}in`,
                paddingBottom: `${AVERY5163.marginTop}in`,
                paddingLeft:  `${AVERY5163.marginSide}in`,
                paddingRight: `${AVERY5163.marginSide}in`,
                boxSizing:   'border-box',
                background:  'white',
                display:     'grid',
                gridTemplateColumns: `repeat(${AVERY5163.cols}, ${AVERY5163.labelW}in)`,
                gridTemplateRows:    `repeat(${AVERY5163.rows}, ${AVERY5163.labelH}in)`,
                columnGap: `${AVERY5163.colGap}in`,
                rowGap:    '0in',
                // screen-only: show as a paper card centered
                margin:    '0.5in auto',
                boxShadow: '0 0 0 1px #ddd',
                pageBreakAfter: 'always',
              }}
            >
              {pageLabels.map((student, idx) => {
                const globalIdx = pageIdx * 10 + idx;
                const sequence = labelSequenceAtIndex(sheetStudents, globalIdx);
                return (
                <div
                  key={idx}
                  style={{
                    width:      `${AVERY5163.labelW}in`,
                    height:     `${AVERY5163.labelH}in`,
                    boxSizing:  'border-box',
                    background: 'white',
                    overflow:   'hidden',
                    // tight padding — maximise usable label area
                    padding: '0.07in 0.1in',
                    // guide lines on screen; removed at print time by className below
                    borderRight:  idx % 2 === 0 ? '1px dashed #bbb' : 'none',
                    borderBottom: '1px dashed #bbb',
                  }}
                  className="print:border-none"
                >
                  {student?.firstName ? (
                    <Avery5163LabelContent student={student} sequence={sequence} />
                  ) : null}
                </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  }

  if (printLayout === 'avery94205') {
    const sheetStudents = [...students];
    while (sheetStudents.length % AVERY94205.labelsPerSheet !== 0) sheetStudents.push({} as Student);

    return (
      <div className="fixed inset-0 bg-gray-100 dark:bg-gray-900 z-50 overflow-auto print:overflow-hidden print:bg-white">
        <div className="print:hidden bg-white dark:bg-gray-800 border-b px-6 py-3 flex flex-col sm:flex-row justify-between items-center gap-3 shadow-sm">
          <div className="flex items-center gap-3 flex-wrap">
            <Label>Label Layout:</Label>
            <LayoutSelect value={printLayout} onChange={onPrintLayoutChange} />
            <AveryPrintGuidance layout="avery94205" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={handleDownloadDocx}
              disabled={downloadingDocx}
              variant="outline"
              className="gap-2 border-blue-400 text-blue-700 hover:bg-blue-50"
            >
              {downloadingDocx
                ? <Loader2 size={16} className="animate-spin" />
                : <FileText size={16} />
              }
              {downloadingDocx ? 'Generating…' : 'Download Word Doc'}
            </Button>
            <Button variant="outline" onClick={onClose} className="gap-2">
              <X size={16} /> Close
            </Button>
          </div>
        </div>

        {Array.from({ length: Math.ceil(sheetStudents.length / AVERY94205.labelsPerSheet) }).map((_, pageIdx) => {
          const pageLabels = sheetStudents.slice(
            pageIdx * AVERY94205.labelsPerSheet,
            pageIdx * AVERY94205.labelsPerSheet + AVERY94205.labelsPerSheet,
          );
          return (
            <div
              key={pageIdx}
              className="avery94205-page"
              style={{
                width:       `${AVERY94205.pageW}in`,
                height:      `${AVERY94205.pageH}in`,
                paddingTop:    `${AVERY94205.marginTop}in`,
                paddingBottom: `${AVERY94205.marginBottom}in`,
                paddingLeft:   `${AVERY94205.marginSide}in`,
                paddingRight:  `${AVERY94205.marginSide}in`,
                boxSizing:   'border-box',
                background:  'white',
                display:     'grid',
                gridTemplateColumns: `repeat(${AVERY94205.cols}, ${AVERY94205.labelW}in)`,
                gridTemplateRows:    `repeat(${AVERY94205.rows}, ${AVERY94205.rowPitch}in)`,
                columnGap: `${AVERY94205.colGap}in`,
                rowGap:    `${AVERY94205.rowGap}in`,
                margin:    '0.5in auto',
                boxShadow: '0 0 0 1px #ddd',
                pageBreakInside: 'avoid',
                breakInside: 'avoid',
                pageBreakAfter: 'always',
              }}
            >
              {pageLabels.map((student, idx) => {
                const globalIdx = pageIdx * AVERY94205.labelsPerSheet + idx;
                const sequence = labelSequenceAtIndex(sheetStudents, globalIdx);
                return (
                <div
                  key={idx}
                  style={{
                    width:      `${AVERY94205.labelW}in`,
                    height:     `${AVERY94205.labelH}in`,
                    boxSizing:  'border-box',
                    background: 'white',
                    overflow:   'hidden',
                    alignSelf:  'start',
                    padding: '0.04in 0.06in',
                    borderRight:  idx % 2 === 0 ? '1px dashed #bbb' : 'none',
                    borderBottom: '1px dashed #bbb',
                  }}
                  className="print:border-none"
                >
                  {student?.firstName ? (
                    <Avery94205LabelContent student={student} sequence={sequence} />
                  ) : null}
                </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-white dark:bg-gray-900 z-50 p-8 overflow-auto print:p-0">
      <div className="print:hidden flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Label>Label Layout:</Label>
          <LayoutSelect value={printLayout} onChange={onPrintLayoutChange} />
          {printLayout === 'avery5160' && (
            <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded px-2 py-1">
              Avery 5160 — browser Print only (no Word Doc for this layout)
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={handlePrint} className="gap-2">
            <Printer size={16} /> Print
          </Button>
          <Button variant="outline" onClick={onClose} className="gap-2">
            <X size={16} /> Close
          </Button>
        </div>
      </div>
      <div
        className={`w-full grid gap-4 print:gap-0 ${cols > 1 ? `grid-cols-${cols}` : ''}`}
        style={{ gridTemplateColumns: `repeat(${cols}, ${width}in)` }}
      >
        {gridStudents.map((student, idx) => {
          const showDashed = !['avery5160', 'avery5163', 'avery94205'].includes(printLayout);
          return (
            <div
              key={idx}
              style={{
                ...labelStyle,
                border: showDashed ? '1px dashed #888' : 'none',
                boxShadow: printLayout === 'avery5163' ? '0 0 0 1px #ccc' : undefined,
                padding: printLayout === 'avery5163' ? '0.18in' : labelStyle.padding,
                background: 'white',
              }}
              className="relative print:break-inside-avoid"
            >
              {student && student.firstName ? (
                <>
                  {printLayout.startsWith('brother') ? (
                    <>
                      <div className="font-bold text-base text-center w-full truncate mb-0.5">
                        {formatFullName(student)}
                      </div>
                      <div className="text-[11px] text-center w-full truncate mb-0.5">DOB: {student.dob}</div>
                      {getLabelId(student) && (
                        <div className="w-full flex flex-col items-center justify-center">
                          <Barcode value={getLabelId(student)} width={1.5} height={22} fontSize={8} margin={0} />
                          <QRCode value={getQrPayload(student)} size={200} level="M" containerStyle={{ width: '0.6in', height: '0.6in' }} />
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="font-bold text-lg mb-0.5 text-center w-full truncate">
                        {formatFullName(student)}
                      </div>
                      <div className="mb-1 text-sm text-center w-full truncate">DOB: {student.dob}</div>
                      {getLabelId(student) && (
                        <div className="w-full flex flex-col items-center justify-center gap-1">
                          <Barcode value={getLabelId(student)} width={2} height={36} fontSize={12} margin={0} />
                          <QRCode value={getQrPayload(student)} size={200} level="M" containerStyle={{ width: '0.7in', height: '0.7in' }} />
                        </div>
                      )}
                    </>
                  )}
                </>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

