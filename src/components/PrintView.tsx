'use client';

import { useEffect, useState } from 'react';
import Barcode from 'react-barcode';
import QRCode from './QRCode';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Download, FileText, Loader2, Printer, X, Info } from 'lucide-react';
import { buildStudentQrPayload } from '@/lib/qrPayload';

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

const LABEL_TEMPLATES = [
  { key: 'single', name: 'Single Label/Page', cols: 1, rows: 1, width: 1.75, height: 1.1 },
  { key: 'double', name: 'Double Label/Page', cols: 2, rows: 1, width: 3.5, height: 1.1 },
  { key: 'avery5160', name: 'Avery 5160 (3x10 Sheet)', cols: 3, rows: 10, width: 2.625, height: 1 },
  { key: 'avery5163', name: 'Avery 5163 (2×5 — Letter 8.5"×11")', cols: AVERY5163.cols, rows: AVERY5163.rows, width: AVERY5163.labelW, height: AVERY5163.labelH },
  { key: 'brother1201', name: 'Brother DK-1201 (1.1" x 3.5")', cols: 1, rows: 1, width: 3.5, height: 1.1, printer: 'QL-800', continuous: true },
  { key: 'brother11208', name: 'Brother DK-11208 (1.1" x 2.1")', cols: 1, rows: 1, width: 2.1, height: 1.1, printer: 'QL-800', continuous: true },
  { key: 'brother2205', name: 'Brother DK-2205 (2.1" x 2.1")', cols: 1, rows: 1, width: 2.1, height: 2.1, printer: 'QL-800', continuous: true },
  { key: 'brother22208', name: 'Brother DK-22208 (2.1" x 2.8")', cols: 1, rows: 1, width: 2.8, height: 2.1, printer: 'QL-800', continuous: true },
  { key: 'custom', name: 'Custom', cols: 1, rows: 1, width: 3.0, height: 1.0 },
];

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
  customLabel: { width: number; height: number; cols: number; rows: number };
  onCustomLabelChange: (label: { width: number; height: number; cols: number; rows: number }) => void;
  showQRCode: boolean;
  cabinetMap?: Record<string, string>;
  drawerMap?: Record<string, string>;
  onClose: () => void;
}

export default function PrintView({
  students,
  printLayout,
  onPrintLayoutChange,
  customLabel,
  onCustomLabelChange,
  showQRCode,
  cabinetMap = {},
  drawerMap = {},
  onClose,
}: PrintViewProps) {
  const [downloadingDocx, setDownloadingDocx] = useState(false);

  async function handleDownloadDocx() {
    setDownloadingDocx(true);
    try {
      const res = await fetch('/api/print/avery5163-docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students }),
      });
      if (!res.ok) throw new Error('Failed to generate document');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `avery5163-labels-${new Date().toISOString().slice(0, 10)}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
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
    if (printLayout === 'avery5163') {
      alert(
        'Avery 5163 — Print Tips:\n\n' +
        '1. Paper size → Letter (8.5" × 11")\n' +
        '2. Margins → None\n' +
        '3. Scale → 100%  (do NOT use "Fit to page")\n' +
        '4. Background graphics → On\n\n' +
        'Click OK, then print.'
      );
    }
    window.print();
  };

  const template = LABEL_TEMPLATES.find(t => t.key === printLayout) || LABEL_TEMPLATES[0];
  const width = printLayout === 'custom' ? customLabel.width : template.width;
  const height = printLayout === 'custom' ? customLabel.height : template.height;
  const cols = printLayout === 'custom' ? customLabel.cols : template.cols;
  const rows = printLayout === 'custom' ? customLabel.rows : template.rows;
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
            <select
              value={printLayout}
              onChange={(e) => onPrintLayoutChange(e.target.value)}
              className="border p-2 rounded focus:outline-blue-400 focus:ring-2"
            >
              {LABEL_TEMPLATES.map(t => (
                <option key={t.key} value={t.key}>{t.name}</option>
              ))}
            </select>
            {template.printer === 'QL-800' && (
              <div className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">
                Brother QL-800 Mode
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
                {student.firstName} {student.lastName}
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
  if (printLayout === 'avery5160' || printLayout === 'custom') {
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
            <select
              value={printLayout}
              onChange={(e) => onPrintLayoutChange(e.target.value)}
              className="border p-2 rounded focus:outline-blue-400 focus:ring-2 text-sm"
            >
              {LABEL_TEMPLATES.map(t => (
                <option key={t.key} value={t.key}>{t.name}</option>
              ))}
            </select>
            <div className="flex items-center gap-1.5 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded px-2 py-1">
              <Info size={13} />
              Print on <strong>Letter&nbsp;(8.5"×11")</strong>, scale&nbsp;<strong>100%</strong>, margins&nbsp;<strong>None</strong>
            </div>
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
            <Button onClick={handlePrint} className="gap-2">
              <Printer size={16} /> Print (CSS)
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
              {pageLabels.map((student, idx) => (
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
                    /*
                     * Layout: [left col: name / DOB / barcode] [right: QR]
                     * Target fill: ~85-90% of the 4"×2" label
                     */
                    <div style={{
                      display: 'flex', flexDirection: 'row',
                      width: '100%', height: '100%',
                      alignItems: 'center',
                      gap: '0.1in',
                    }}>

                      {/* ── Left column ── */}
                      <div style={{
                        flex: 1,
                        display: 'flex', flexDirection: 'column',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        gap: '0.02in',
                      }}>
                        {/* Full name — 16 pt bold */}
                        <div style={{
                          fontWeight: 700,
                          fontSize: '16pt',
                          lineHeight: 1.1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {student.firstName} {student.lastName}
                        </div>

                        {/* DOB — 10 pt */}
                        <div style={{
                          fontSize: '10pt',
                          lineHeight: 1.2,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          DOB: {student.dob}
                        </div>

                        {/* Barcode — taller to fill remaining vertical space */}
                        {getLabelId(student) && (
                          <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '0.03in' }}>
                            <Barcode
                              value={getLabelId(student)}
                              width={1.2}
                              height={30}
                              fontSize={7}
                              margin={0}
                            />
                          </div>
                        )}
                      </div>

                      {/* ── Right: QR code — 1.55" fills ~86% of the 1.8" available height ── */}
                      {getLabelId(student) && (
                        <QRCode
                          value={getQrPayload(student)}
                          size={300}
                          level="M"
                          containerStyle={{ width: '1.55in', height: '1.55in', flexShrink: 0 }}
                        />
                      )}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-white dark:bg-gray-900 z-50 p-8 overflow-auto print:p-0">
      <div className="print:hidden flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <div className="flex items-center gap-2">
          <Label>Label Layout:</Label>
          <select
            value={printLayout}
            onChange={(e) => onPrintLayoutChange(e.target.value)}
            className="border p-2 rounded focus:outline-blue-400 focus:ring-2"
          >
            {LABEL_TEMPLATES.map(t => (
              <option key={t.key} value={t.key}>{t.name}</option>
            ))}
          </select>
          {printLayout === 'custom' && (
            <>
              <Label className="ml-4">Width (in):</Label>
              <Input
                type="number"
                min="0.5"
                step="0.01"
                value={customLabel.width}
                onChange={(e) => onCustomLabelChange({ ...customLabel, width: parseFloat(e.target.value) })}
                className="w-20"
              />
              <Label className="ml-2">Height (in):</Label>
              <Input
                type="number"
                min="0.5"
                step="0.01"
                value={customLabel.height}
                onChange={(e) => onCustomLabelChange({ ...customLabel, height: parseFloat(e.target.value) })}
                className="w-20"
              />
              <Label className="ml-2">Cols:</Label>
              <Input
                type="number"
                min="1"
                max="10"
                value={customLabel.cols}
                onChange={(e) => onCustomLabelChange({ ...customLabel, cols: parseInt(e.target.value) })}
                className="w-14"
              />
              <Label className="ml-2">Rows:</Label>
              <Input
                type="number"
                min="1"
                max="30"
                value={customLabel.rows}
                onChange={(e) => onCustomLabelChange({ ...customLabel, rows: parseInt(e.target.value) })}
                className="w-14"
              />
            </>
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
          const showDashed = !['avery5160', 'avery5163'].includes(printLayout);
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
                        {student.firstName} {student.lastName}
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
                        {student.firstName} {student.lastName}
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

