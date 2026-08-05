/**
 * Drawer sections — automatic filing subdivisions for Data Leads.
 * Not shown on intake; assigned when a student is placed in a drawer.
 *
 * Default: 8 sections per drawer (1/8 of capacity).
 *   400 → Section 01–08 × 50
 *   200 → Section 01–08 × 25
 *   100 → Section 01–08 × 13 (last sections share the remainder)
 */

export const DRAWER_CAPACITY_PRESETS = [100, 200, 400] as const;
export const SECTIONS_PER_DRAWER = 8;
/** Inclusive bounds for custom drawer capacity (files). */
export const DRAWER_CAPACITY_MIN = 1;
export const DRAWER_CAPACITY_MAX = 5000;

export function isDrawerCapacityPreset(capacity: number): boolean {
  return (DRAWER_CAPACITY_PRESETS as readonly number[]).includes(capacity);
}

export function clampDrawerCapacity(value: number): number {
  const n = Math.floor(Number(value) || 0);
  return Math.min(DRAWER_CAPACITY_MAX, Math.max(DRAWER_CAPACITY_MIN, n));
}

export type DrawerSectionBreakdown = {
  label: string;
  number: number;
  filled: number;
  capacity: number;
  status: 'empty' | 'partial' | 'full' | 'future';
};

/** Files per section (ceil so 8 sections always cover the drawer). */
export function getDrawerSectionSize(drawerCapacity: number): number {
  const capacity = Math.max(0, Math.floor(Number(drawerCapacity) || 0));
  if (capacity <= 0) return 1;
  return Math.max(1, Math.ceil(capacity / SECTIONS_PER_DRAWER));
}

export function formatDrawerSectionLabel(sectionNumber: number): string {
  const n = Math.max(1, Math.min(SECTIONS_PER_DRAWER, Math.floor(sectionNumber)));
  return `Section ${String(n).padStart(2, '0')}`;
}

/**
 * 0-based index within the drawer (currentCount before insert)
 * → 1-based section number, clamped to 01–08.
 */
export function sectionNumberForDrawerIndex(
  indexInDrawer: number,
  drawerCapacity: number,
): number {
  const index = Math.max(0, Math.floor(Number(indexInDrawer) || 0));
  const size = getDrawerSectionSize(drawerCapacity);
  return Math.min(SECTIONS_PER_DRAWER, Math.floor(index / size) + 1);
}

export function assignDrawerSection(
  indexInDrawer: number,
  drawerCapacity: number,
): string {
  return formatDrawerSectionLabel(
    sectionNumberForDrawerIndex(indexInDrawer, drawerCapacity),
  );
}

/** Occupancy snapshot for cabinet management cards. */
export function getDrawerSectionBreakdown(
  currentCount: number,
  drawerCapacity: number,
): DrawerSectionBreakdown[] {
  const capacity = Math.max(0, Math.floor(Number(drawerCapacity) || 0));
  const filledTotal = Math.max(0, Math.floor(Number(currentCount) || 0));
  const size = getDrawerSectionSize(capacity);

  return Array.from({ length: SECTIONS_PER_DRAWER }, (_, i) => {
    const number = i + 1;
    const start = i * size;
    // Last section may be shorter so totals match drawer capacity
    const sectionCap =
      number === SECTIONS_PER_DRAWER
        ? Math.max(0, capacity - start)
        : Math.min(size, Math.max(0, capacity - start));
    const filled = Math.max(0, Math.min(sectionCap, filledTotal - start));
    let status: DrawerSectionBreakdown['status'] = 'empty';
    if (sectionCap <= 0) status = 'future';
    else if (filled <= 0 && filledTotal <= start) status = 'empty';
    else if (filled >= sectionCap) status = 'full';
    else if (filled > 0) status = 'partial';
    else status = 'empty';

    return {
      label: formatDrawerSectionLabel(number),
      number,
      filled,
      capacity: sectionCap,
      status,
    };
  }).filter((s) => s.capacity > 0);
}
