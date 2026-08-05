/**
 * Avery 94205 typography — same layout as Avery 5163, scaled for 1.5" × 3.75"
 * labels (~75% of 5163’s 2" × 4"). Keep CSS preview and Word export aligned.
 */

export const LABEL_FONT_FAMILY = '"Times New Roman", Times, serif';

/** Outer label padding (CSS). */
export const LABEL_CONTENT_INSET_LEFT = '0.08in';
export const LABEL_CONTENT_INSET_TOP = '0.06in';
export const LABEL_COLUMN_GAP = '0.09in';

/** Spacing between stacked text fields (CSS). */
export const LABEL_NAME_TO_DOB_GAP = '0.07in';
export const LABEL_DOB_TO_BARCODE_GAP = '0.06in';

/** Text column vs QR column split — match 5163 layout. */
export const LABEL_TEXT_COLUMN_RATIO = 0.52;

/** Name size in CSS points; scales down for long names. */
export function labelNameFontSizePt(fullName: string) {
  if (fullName.length > 32) return 11;
  if (fullName.length > 24) return 12;
  return 14;
}

/** Name size in Word half-points (1 pt = 2 half-points). */
export function labelNameFontSizeHalfPt(fullName: string) {
  return labelNameFontSizePt(fullName) * 2;
}

export const LABEL_DOB_FONT_SIZE_PT = 9;
export const LABEL_DOB_FONT_SIZE_HALF_PT = LABEL_DOB_FONT_SIZE_PT * 2;

/** Sequence number size (CSS pt / Word half-points). */
export const LABEL_SEQ_FONT_SIZE_PT = 9;
export const LABEL_SEQ_FONT_SIZE_HALF_PT = LABEL_SEQ_FONT_SIZE_PT * 2;

/**
 * QR size — nearly full label height (1.5") minus padding, same visual weight
 * as 5163’s ~1.65" QR on a 2" label.
 */
export const LABEL_QR_SIZE_IN = '1.15in';

/** QR size in Word export (pixels in ImageRun transformation). */
export const LABEL_QR_SIZE_PX = 88;

/** Word barcode ImageRun size (CSS px). */
export const LABEL_BARCODE_WIDTH_PX = 210;
export const LABEL_BARCODE_HEIGHT_PX = 18;

/** Word cell margins (twips: 1 inch = 1440). */
export const LABEL_DOCX_CELL_MARGIN_LEFT = 110;
export const LABEL_DOCX_CELL_MARGIN_RIGHT = 30;
export const LABEL_DOCX_CELL_MARGIN_TOP = 55;
export const LABEL_DOCX_CELL_MARGIN_BOTTOM = 30;

/** Word inner text-column margins (twips). */
export const LABEL_DOCX_TEXT_MARGIN_TOP = 45;
export const LABEL_DOCX_TEXT_MARGIN_LEFT = 50;
export const LABEL_DOCX_TEXT_MARGIN_RIGHT = 35;

/** Word paragraph spacing after (twips). */
export const LABEL_DOCX_NAME_AFTER = 28;
export const LABEL_DOCX_DOB_AFTER = 22;

/** Word EXACT line heights (twips). */
export const LABEL_DOCX_NAME_LINE = 280;
export const LABEL_DOCX_DOB_LINE = 200;
