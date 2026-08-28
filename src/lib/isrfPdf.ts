import { readFile } from 'fs/promises';
import path from 'path';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import {
  ISRF_TEMPLATE_RELATIVE_PATH,
  buildIsrfFieldValues,
  todayIsrfDate,
  type IsrfFillContext,
  type IsrfStudentInput,
} from '@/lib/isrfForm';

let templateBytes: Uint8Array | null = null;

export async function loadIsrfTemplateBytes(): Promise<Uint8Array> {
  if (templateBytes) return templateBytes;
  const filePath = path.join(process.cwd(), ISRF_TEMPLATE_RELATIVE_PATH);
  templateBytes = await readFile(filePath);
  return templateBytes;
}

function setTextField(form: ReturnType<PDFDocument['getForm']>, name: string, value: string) {
  if (!value) return;
  try {
    const field = form.getTextField(name);
    const max = field.getMaxLength();
    field.setText(max ? value.slice(0, max) : value);
    field.setFontSize(9);
  } catch {
    // Template revision may rename a box; skip rather than fail the whole PDF.
  }
}

function setRadio(form: ReturnType<PDFDocument['getForm']>, name: string, option: string) {
  if (!option) return;
  try {
    form.getRadioGroup(name).select(option);
  } catch {
    // Option names differ on some Yes/No pairs; leave blank.
  }
}

function setCheckBox(form: ReturnType<PDFDocument['getForm']>, name: string, on: boolean) {
  if (!on) return;
  try {
    form.getCheckBox(name).check();
  } catch {
    // Template revision may rename a box; skip rather than fail the whole PDF.
  }
}

export async function fillIsrfPdf(
  student: IsrfStudentInput,
  ctx: IsrfFillContext = {},
): Promise<Uint8Array> {
  const bytes = await loadIsrfTemplateBytes();
  const pdf = await PDFDocument.load(bytes);
  const form = pdf.getForm();
  const values = buildIsrfFieldValues(student, {
    completedBy: ctx.completedBy,
    signedOn: ctx.signedOn || todayIsrfDate(),
  });

  for (const [name, value] of Object.entries(values.text)) {
    setTextField(form, name, value);
  }
  for (const [name, option] of Object.entries(values.radios)) {
    setRadio(form, name, option);
  }
  for (const [name, on] of Object.entries(values.checkboxes)) {
    setCheckBox(form, name, on);
  }

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  form.updateFieldAppearances(font);
  return pdf.save({ updateFieldAppearances: false });
}
