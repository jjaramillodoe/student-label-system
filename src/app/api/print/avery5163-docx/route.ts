/**
 * POST /api/print/avery5163-docx
 *
 * Generates an Avery 5163 Word document.
 *
 * Physical Avery 5163 sheet geometry:
 *   Sheet  :  8.5"  × 11"  (Letter)
 *   Labels :  4.0"  × 2.0" — 2 cols × 5 rows = 10 per page
 *   Left margin  :  0.1563" (= 5/32")
 *   Right margin :  0.0938"
 *   Top margin   :  0.5"
 *   Bottom margin:  0.5"  (bottom = top, labels flush to bottom margin)
 *   Col gap      :  0.25"  (between the two label columns)
 *
 * DOCX table layout (3 columns: label | gap | label):
 *   Col A   5760 tw  (4")
 *   Col B    360 tw  (0.25" inter-column gap — empty spacer)
 *   Col C   5760 tw  (4")
 *   Total  11880 tw  (8.25")
 *
 *   Left page margin  225 tw (0.1563")
 *   Right page margin 135 tw (0.0938")
 *   225 + 11880 + 135 = 12240 = PAGE_W ✓
 *
 * Row height 2880 tw (exactly 2.0") so every row aligns with a physical label.
 * The docx library appends a Normal-paragraph after the table (~440 tw).
 * Bottom margin reduced to 200 tw (0.139") so:
 *   5×2880 + 440 = 14840  <  15840 − 720 − 200 = 14920  ✓ (80 tw slack)
 *
 * Image paragraphs use AUTO spacing (not EXACT): Word expands an EXACT line
 * to fit an inline image anyway, so EXACT on images gives false security.
 * Text paragraphs use EXACT for predictable line heights.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession }           from 'next-auth';
import { authOptions }                from '@/lib/authOptions';
import {
  Document, Packer,
  Table, TableRow, TableCell,
  Paragraph, ImageRun, TextRun,
  WidthType, HeightRule,
  BorderStyle, VerticalAlign,
  LineRuleType, AlignmentType,
  type ISectionOptions,
} from 'docx';
import QRCode   from 'qrcode';
// @ts-ignore
import bwipjs   from 'bwip-js';
import {
  LABEL_DOCX_CELL_MARGIN_BOTTOM,
  LABEL_DOCX_CELL_MARGIN_LEFT,
  LABEL_DOCX_CELL_MARGIN_RIGHT,
  LABEL_DOCX_CELL_MARGIN_TOP,
  LABEL_DOCX_DOB_AFTER,
  LABEL_DOCX_NAME_AFTER,
  LABEL_DOCX_TEXT_MARGIN_LEFT,
  LABEL_DOCX_TEXT_MARGIN_RIGHT,
  LABEL_DOCX_TEXT_MARGIN_TOP,
  LABEL_DOB_FONT_SIZE_HALF_PT,
  LABEL_QR_SIZE_PX,
  LABEL_TEXT_COLUMN_RATIO,
  labelNameFontSizeHalfPt,
} from '@/lib/avery5163LabelStyle';
import { formatFullName } from '@/lib/personName';

// ── Page geometry (twips: 1 inch = 1440) ─────────────────────────────────────
const T              = 1440;
const PAGE_W         = Math.round(8.5    * T);   // 12240
const PAGE_H         = Math.round(11     * T);   // 15840
const MARGIN_TOP     = Math.round(0.5    * T);   // 720
const MARGIN_BOTTOM  = 200;                       // 0.139" — leaves 80 tw slack for docx trailing para
const MARGIN_LEFT    = Math.round(0.1563 * T);   // 225  (Avery 5163 spec)
const MARGIN_RIGHT   = Math.round(0.0938 * T);   // 135  (Avery 5163 spec)

// Label dimensions
const LABEL_W        = Math.round(4      * T);   // 5760
const LABEL_H_ROW    = Math.round(2      * T);   // 2880 — exactly 2", matches physical label

// Inter-column gap column (0.25" between the two label columns)
const GAP_W          = Math.round(0.25   * T);   // 360

// ── Border helpers ────────────────────────────────────────────────────────────
const N   = { style: BorderStyle.NONE, size: 0, color: 'auto' } as const;
const NBR = { top: N, bottom: N, left: N, right: N };
const NBA = { ...NBR, insideH: N, insideV: N };

// ── Image generators ─────────────────────────────────────────────────────────
async function makeQR(text: string): Promise<Buffer> {
  return QRCode.toBuffer(text, {
    type: 'png',
    width: 300,               // 4× oversampled for crispness at 75 px display size
    margin: 1,
    errorCorrectionLevel: 'M',
  });
}

function makeBarcode(text: string): Promise<Buffer> {
  return new Promise((res, rej) =>
    bwipjs.toBuffer(
      {
        bcid:        'code128',
        text,
        scale:       3,
        height:      6,       // compact bar height (mm)
        includetext: true,
        textxalign:  'center',
        textsize:    5,
      },
      (e: Error | null, buf: Buffer) => (e ? rej(e) : res(buf)),
    ),
  );
}

// ── Paragraph builders ────────────────────────────────────────────────────────
type Align = (typeof AlignmentType)[keyof typeof AlignmentType];

/** Text with EXACT line height for deterministic vertical measurement. */
function textPara(
  children: TextRun[],
  lineTwips: number,
  afterTwips: number,
  align: Align = AlignmentType.LEFT,
): Paragraph {
  return new Paragraph({
    children,
    alignment: align,
    spacing: { before: 0, after: afterTwips, line: lineTwips, lineRule: LineRuleType.EXACT },
  });
}

/**
 * Image with AUTO line spacing. Word silently expands an EXACT line to fit an
 * inline image, so EXACT gives no benefit for images. AUTO + the table-row's
 * EXACT height is the correct combination.
 */
function imagePara(
  data: Buffer,
  w: number,
  h: number,
  afterTwips: number,
  align: Align = AlignmentType.CENTER,
): Paragraph {
  return new Paragraph({
    children:  [new ImageRun({ type: 'png', data, transformation: { width: w, height: h } })],
    alignment: align,
    spacing:   { before: 0, after: afterTwips },
  });
}

// ── Label cell ────────────────────────────────────────────────────────────────
interface StudentData {
  firstName?: string;
  lastName?:  string;
  dob?:       string;
  labelId?:   string;
  studentId?: string;
}

const LABEL_CELL_PROPS = {
  borders:       NBR,
  width:         { size: LABEL_W, type: WidthType.DXA },
  margins:       {
    top: LABEL_DOCX_CELL_MARGIN_TOP,
    bottom: LABEL_DOCX_CELL_MARGIN_BOTTOM,
    left: LABEL_DOCX_CELL_MARGIN_LEFT,
    right: LABEL_DOCX_CELL_MARGIN_RIGHT,
  },
  verticalAlign: VerticalAlign.TOP,
} as const;

const SPACER_CELL_PROPS = {
  borders: NBR,
  width:   { size: GAP_W, type: WidthType.DXA },
  margins: { top: 0, bottom: 0, left: 0, right: 0 },
} as const;

/** Empty spacer cell that fills the inter-column gap. */
function spacerCell(): TableCell {
  return new TableCell({
    ...SPACER_CELL_PROPS,
    children: [
      new Paragraph({
        children: [],
        spacing: { before: 0, after: 0, line: 1, lineRule: LineRuleType.EXACT },
      }),
    ],
  });
}

/** Empty placeholder for a missing student slot. */
function emptyCell(): TableCell {
  return new TableCell({
    ...LABEL_CELL_PROPS,
    children: [
      new Paragraph({
        children: [],
        spacing: { before: 0, after: 0, line: 1, lineRule: LineRuleType.EXACT },
      }),
    ],
  });
}

async function buildLabelCell(s: StudentData | null): Promise<TableCell> {
  if (!s?.firstName) return emptyCell();

  const labelId = s.labelId || s.studentId || '';
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const qrText  = labelId ? `${appUrl}/student/${labelId}` : formatFullName(s);
  const fullName = formatFullName(s);
  const nameSize = labelNameFontSizeHalfPt(fullName);

  const [qrBuf, barBuf] = await Promise.all([
    makeQR(qrText),
    labelId ? makeBarcode(labelId) : Promise.resolve(null as unknown as Buffer),
  ]);

  // Horizontal layout inside a 4" × 2" label cell:
  // [ name (wraps) / DOB / barcode ]  |  [ QR ]
  const INNER_W  = LABEL_W - LABEL_DOCX_CELL_MARGIN_LEFT - LABEL_DOCX_CELL_MARGIN_RIGHT;
  const LEFT_COL = Math.round(INNER_W * LABEL_TEXT_COLUMN_RATIO);
  const RIGHT_COL = INNER_W - LEFT_COL;

  const leftParas: Paragraph[] = [
    textPara(
      [new TextRun({ text: fullName, bold: true, size: nameSize, font: 'Times New Roman' })],
      360, LABEL_DOCX_NAME_AFTER, AlignmentType.LEFT,
    ),
    textPara(
      [new TextRun({ text: `DOB: ${s.dob ?? ''}`, size: LABEL_DOB_FONT_SIZE_HALF_PT, font: 'Times New Roman' })],
      240, LABEL_DOCX_DOB_AFTER, AlignmentType.LEFT,
    ),
    ...(barBuf ? [imagePara(barBuf, 230, 22, 0, AlignmentType.LEFT)] : []),
  ];

  const rightParas: Paragraph[] = [
    imagePara(qrBuf, LABEL_QR_SIZE_PX, LABEL_QR_SIZE_PX, 0, AlignmentType.CENTER),
  ];

  return new TableCell({
    ...LABEL_CELL_PROPS,
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Table({
        width:        { size: INNER_W, type: WidthType.DXA },
        columnWidths: [LEFT_COL, RIGHT_COL],
        borders:      NBA,
        rows: [
          new TableRow({
            cantSplit: true,
            children: [
              new TableCell({
                borders:       NBR,
                width:         { size: LEFT_COL, type: WidthType.DXA },
                margins:       {
                  top: LABEL_DOCX_TEXT_MARGIN_TOP,
                  bottom: 0,
                  left: LABEL_DOCX_TEXT_MARGIN_LEFT,
                  right: LABEL_DOCX_TEXT_MARGIN_RIGHT,
                },
                verticalAlign: VerticalAlign.TOP,
                children:      leftParas,
              }),
              new TableCell({
                borders:       NBR,
                width:         { size: RIGHT_COL, type: WidthType.DXA },
                margins:       { top: 0, bottom: 0, left: 20, right: 20 },
                verticalAlign: VerticalAlign.CENTER,
                children:      rightParas,
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

// ── Document builder ──────────────────────────────────────────────────────────
async function buildDocument(students: StudentData[]): Promise<Buffer> {
  const padded = [...students];
  while (padded.length % 10 !== 0) padded.push({});

  const sections: ISectionOptions[] = [];

  for (let p = 0; p < padded.length / 10; p++) {
    const slice = padded.slice(p * 10, p * 10 + 10);
    const cells = await Promise.all(slice.map(buildLabelCell));

    const rows = Array.from({ length: 5 }, (_, r) =>
      new TableRow({
        height:    { value: LABEL_H_ROW, rule: HeightRule.EXACT },
        cantSplit: true,
        // 3 columns: left label | inter-label gap (spacer) | right label
        children: [cells[r * 2], spacerCell(), cells[r * 2 + 1]],
      }),
    );

    sections.push({
      properties: {
        page: {
          size:   { width: PAGE_W, height: PAGE_H },
          margin: {
            top:    MARGIN_TOP,
            bottom: MARGIN_BOTTOM,
            left:   MARGIN_LEFT,
            right:  MARGIN_RIGHT,
          },
        },
      },
      children: [
        new Table({
          // Total width = LABEL_W + GAP_W + LABEL_W = 11880 (8.25")
          width:        { size: LABEL_W + GAP_W + LABEL_W, type: WidthType.DXA },
          columnWidths: [LABEL_W, GAP_W, LABEL_W],
          borders:      NBA,
          rows,
        }),
      ],
    });
  }

  return Packer.toBuffer(new Document({ sections }));
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let students: StudentData[] = [];
  try {
    students = (await req.json()).students ?? [];
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  if (!students.length) {
    return NextResponse.json({ error: 'No students provided' }, { status: 400 });
  }

  try {
    const buf  = await buildDocument(students);
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type':        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="avery5163-${date}.docx"`,
        'Content-Length':      String(buf.length),
      },
    });
  } catch (err) {
    console.error('[avery5163-docx]', err);
    return NextResponse.json({ error: 'Failed to generate document' }, { status: 500 });
  }
}
