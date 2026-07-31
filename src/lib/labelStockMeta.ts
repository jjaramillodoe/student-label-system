/**
 * Client-safe label stock template metadata (no Node/Mongo/email imports).
 */

export type StockUnit = 'sheets' | 'labels';

export type LabelStockTemplateMeta = {
  key: string;
  name: string;
  /** Labels produced per physical sheet/roll unit consumed. */
  labelsPerUnit: number;
  unit: StockUnit;
  /** Default pack size for restock (+1 box / +1 roll). */
  defaultPackSize: number;
  unitLabel: string;
  packLabel: string;
};

export const LABEL_STOCK_TEMPLATES: LabelStockTemplateMeta[] = [
  {
    key: 'avery5160',
    name: 'Avery 5160 (3x10 Sheet)',
    labelsPerUnit: 30,
    unit: 'sheets',
    defaultPackSize: 100,
    unitLabel: 'sheets',
    packLabel: 'box',
  },
  {
    key: 'avery5163',
    name: 'Avery 5163 (2x5 Sheet)',
    labelsPerUnit: 10,
    unit: 'sheets',
    defaultPackSize: 100,
    unitLabel: 'sheets',
    packLabel: 'box',
  },
  {
    key: 'avery94205',
    name: 'Avery 94205 (2x5 — 1.5"×3.75")',
    labelsPerUnit: 10,
    unit: 'sheets',
    defaultPackSize: 100,
    unitLabel: 'sheets',
    packLabel: 'box',
  },
  {
    key: 'brother1201',
    name: 'Brother DK-1201 (1.1" x 3.5")',
    labelsPerUnit: 1,
    unit: 'labels',
    defaultPackSize: 400,
    unitLabel: 'labels',
    packLabel: 'roll',
  },
  {
    key: 'brother11208',
    name: 'Brother DK-11208 (1.1" x 2.1")',
    labelsPerUnit: 1,
    unit: 'labels',
    defaultPackSize: 400,
    unitLabel: 'labels',
    packLabel: 'roll',
  },
  {
    key: 'brother2205',
    name: 'Brother DK-2205 (2.1" x 2.1")',
    labelsPerUnit: 1,
    unit: 'labels',
    defaultPackSize: 400,
    unitLabel: 'labels',
    packLabel: 'roll',
  },
  {
    key: 'brother22208',
    name: 'Brother DK-22208 (2.1" x 2.8")',
    labelsPerUnit: 1,
    unit: 'labels',
    defaultPackSize: 300,
    unitLabel: 'labels',
    packLabel: 'roll',
  },
];

export function getTemplateMeta(template: string): LabelStockTemplateMeta {
  return (
    LABEL_STOCK_TEMPLATES.find((t) => t.key === template) || {
      key: template,
      name: template,
      labelsPerUnit: 1,
      unit: 'labels' as StockUnit,
      defaultPackSize: 100,
      unitLabel: 'units',
      packLabel: 'pack',
    }
  );
}

/** Physical stock units consumed for a print of `labelCount` labels. */
export function unitsForLabelCount(template: string, labelCount: number): number {
  const meta = getTemplateMeta(template);
  const count = Math.max(0, Math.floor(Number(labelCount) || 0));
  if (count === 0) return 0;
  return Math.ceil(count / meta.labelsPerUnit);
}

export function normalizeSchoolKey(school?: string | null): string {
  return String(school ?? '').trim();
}
