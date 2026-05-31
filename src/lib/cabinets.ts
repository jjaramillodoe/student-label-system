import type { Cabinet } from '@/types/cabinet';

export interface NextCabinetSlot {
  cabinet: Cabinet;
  drawer: Cabinet['drawers'][number];
  spacesLeft: number;
}

export function isActiveCabinet(cabinet: Pick<Cabinet, 'status'>) {
  return (cabinet.status ?? 'Active') !== 'Archived';
}

/** First open drawer on the lowest active cabinet (by identifier, then name). */
export function findNextAvailableSlot(cabinets: Cabinet[]): NextCabinetSlot | null {
  const activeCabinets = cabinets.filter(
    c => isActiveCabinet(c) && c.currentCount < c.totalCapacity,
  );

  activeCabinets.sort((a, b) => {
    const nA = parseInt(a.identifier || '', 10);
    const nB = parseInt(b.identifier || '', 10);
    if (!Number.isNaN(nA) && !Number.isNaN(nB)) return nA - nB;
    return a.name.localeCompare(b.name);
  });

  for (const cabinet of activeCabinets) {
    const drawers = [...cabinet.drawers].sort((a, b) => a.name.localeCompare(b.name));
    const drawer = drawers.find(d => d.currentCount < d.capacity);
    if (drawer) {
      return { cabinet, drawer, spacesLeft: drawer.capacity - drawer.currentCount };
    }
  }

  return null;
}

export function studentNeedsActiveDrawer(student: {
  archived?: boolean;
  status?: string;
  cabinet?: string;
}) {
  return (
    student.archived === true ||
    student.status === 'Archived' ||
    !student.cabinet
  );
}
