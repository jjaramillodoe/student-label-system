/**
 * Avery 94205 (Presta 94205) sheet geometry on Letter paper (8.5" × 11"):
 *   Labels : 3.75" × 1.5" — 2 cols × 5 rows = 10 per sheet
 *   Top/bottom margin : 0.625"
 *   Left/right margin : 0.375"
 *   Column gap        : 0.25"
 *
 * Row pitch = (11 − 1.25) / 5 = 1.95" per row slot (label 1.5" + 0.45" spacing).
 * No separate CSS/Word gap rows — matches Avery 5163 pattern and fills the page exactly.
 */

export const AVERY94205 = {
  pageW:      8.5,
  pageH:      11,
  marginTop:    0.625,
  marginBottom: 0.625,
  marginSide:   0.375,
  colGap:       0.25,
  rowGap:       0,
  labelW:       3.75,
  labelH:       1.5,
  /** Height of each grid/table row slot on the sheet. */
  rowPitch:     1.95,
  cols:         2,
  rows:         5,
  labelsPerSheet: 10,
} as const;
