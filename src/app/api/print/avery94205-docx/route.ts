/**
 * POST /api/print/avery94205-docx
 *
 * Generates an Avery 94205 Word document.
 *
 * Physical Avery 94205 sheet geometry:
 *   Sheet  :  8.5"  × 11"  (Letter)
 *   Labels :  3.75" × 1.5" — 2 cols × 5 rows = 10 per page
 *   Left margin  :  0.375"
 *   Right margin :  0.375"
 *   Top margin   :  0.625"
 *   Bottom margin:  0.625" (reduced in DOCX for library trailing paragraph)
 *   Col gap      :  0.25"
 *   Row pitch    :  1.95"  (5 rows fill 9.75" label area exactly)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession }           from 'next-auth';
import { authOptions }                from '@/lib/authOptions';
import { AVERY94205 }                 from '@/lib/avery94205Geometry';
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
} from '@/lib/avery94205LabelStyle';
import { formatFullName } from '@/lib/personName';

const T              = 1440;
const PAGE_W         = Math.round(AVERY94205.pageW    * T);   // 12240
const PAGE_H         = Math.round(AVERY94205.pageH    * T);   // 15840
const MARGIN_TOP     = Math.round(AVERY94205.marginTop    * T);   // 900
// docx appends a Normal paragraph after the table (~440 tw); keep slack like Avery 5163
const MARGIN_BOTTOM  = 400;
const MARGIN_LEFT    = Math.round(AVERY94205.marginSide   * T);   // 540
const MARGIN_RIGHT   = Math.round(AVERY94205.marginSide   * T);   // 540

const LABEL_W        = Math.round(AVERY94205.labelW    * T);   // 5400
const LABEL_H_ROW    = Math.round(AVERY94205.rowPitch  * T);   // 2808 — 1.95" row slot
const GAP_W          = Math.round(AVERY94205.colGap    * T);   // 360

const N   = { style: BorderStyle.NONE, size: 0, color: 'auto' } as const;
const NBR = { top: N, bottom: N, left: N, right: N };
const NBA = { ...NBR, insideH: N, insideV: N };

async function makeQR(text: string): Promise<Buffer> {
  return QRCode.toBuffer(text, {
    type: 'png',
    width: 220,
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
        scale:       2,
        height:      4,
        includetext: true,
        textxalign:  'center',
        textsize:    4,
      },
      (e: Error | null, buf: Buffer) => (e ? rej(e) : res(buf)),
    ),
  );
}

type Align = (typeof AlignmentType)[keyof typeof AlignmentType];

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

  const INNER_W   = LABEL_W - LABEL_DOCX_CELL_MARGIN_LEFT - LABEL_DOCX_CELL_MARGIN_RIGHT;
  const LEFT_COL  = Math.round(INNER_W * LABEL_TEXT_COLUMN_RATIO);
  const RIGHT_COL = INNER_W - LEFT_COL;

  const leftParas: Paragraph[] = [
    textPara(
      [new TextRun({ text: fullName, bold: true, size: nameSize, font: 'Times New Roman' })],
      220, LABEL_DOCX_NAME_AFTER, AlignmentType.LEFT,
    ),
    textPara(
      [new TextRun({ text: `DOB: ${s.dob ?? ''}`, size: LABEL_DOB_FONT_SIZE_HALF_PT, font: 'Times New Roman' })],
      180, LABEL_DOCX_DOB_AFTER, AlignmentType.LEFT,
    ),
    ...(barBuf ? [imagePara(barBuf, 180, 16, 0, AlignmentType.LEFT)] : []),
  ];

  const rightParas: Paragraph[] = [
    imagePara(qrBuf, LABEL_QR_SIZE_PX, LABEL_QR_SIZE_PX, 0, AlignmentType.CENTER),
  ];

  return new TableCell({
    ...LABEL_CELL_PROPS,
    verticalAlign: VerticalAlign.TOP,
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
                margins:       { top: 0, bottom: 0, left: 10, right: 10 },
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

async function buildDocument(students: StudentData[]): Promise<Buffer> {
  const padded = [...students];
  while (padded.length % 10 !== 0) padded.push({});

  const sections: ISectionOptions[] = [];

  for (let p = 0; p < padded.length / 10; p++) {
    const slice = padded.slice(p * 10, p * 10 + 10);
    const cells = await Promise.all(slice.map(buildLabelCell));

    const rows = Array.from({ length: AVERY94205.rows }, (_, r) =>
      new TableRow({
        height:    { value: LABEL_H_ROW, rule: HeightRule.EXACT },
        cantSplit: true,
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
        'Content-Disposition': `attachment; filename="avery94205-${date}.docx"`,
        'Content-Length':      String(buf.length),
      },
    });
  } catch (err) {
    console.error('[avery94205-docx]', err);
    return NextResponse.json({ error: 'Failed to generate document' }, { status: 500 });
  }
}
