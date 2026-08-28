import type { Cabinet } from '@/types/cabinet';

export interface NextCabinetSlot {
  cabinet: Cabinet;
  drawer: Cabinet['drawers'][number];
  spacesLeft: number;
}

export function isCabinetArchived(cabinet: object): boolean {
  const doc = cabinet as { status?: string; isArchived?: boolean };
  if (doc.isArchived === true) return true;
  if (doc.isArchived === false) return false;
  return (doc.status ?? 'Active') === 'Archived';
}

export function isActiveCabinet(cabinet: object) {
  return !isCabinetArchived(cabinet);
}

export function cabinetArchiveSetFields(archived: boolean, now = new Date().toISOString()) {
  if (archived) {
    return { isArchived: true as const, status: 'Archived' as const, archivedAt: now };
  }
  return { isArchived: false as const, status: 'Active' as const };
}

export function withCabinetArchiveFlags<T extends { status?: string; isArchived?: boolean }>(
  cabinet: T,
): T & { isArchived: boolean; status: 'Active' | 'Archived' } {
  const archived = isCabinetArchived(cabinet);
  return {
    ...cabinet,
    isArchived: archived,
    status: archived ? 'Archived' : 'Active',
  };
}

export function serializeCabinetRecord(cabinet: object, extras?: Record<string, unknown>) {
  const doc = cabinet as {
    _id?: unknown;
    drawers?: Array<{ _id?: unknown } & Record<string, unknown>>;
    status?: string;
    isArchived?: boolean;
  } & Record<string, unknown>;
  return withCabinetArchiveFlags({
    ...doc,
    _id: String(doc._id),
    drawers: (doc.drawers || []).map((d) => ({
      ...d,
      _id: String(d._id ?? ''),
    })),
    ...extras,
  });
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
    const drawer = drawers.find(
      (d) => !d.locked && d.currentCount < d.capacity,
    );
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

export function studentIsArchived(student: {
  archived?: boolean;
  status?: string;
}): boolean {
  return student.archived === true || student.status === 'Archived';
}

export function studentHasArchiveBoxLocation(student: {
  archiveBoxId?: string;
  archiveBoxLabel?: string;
  archiveLocation?: string;
}): boolean {
  return Boolean(
    student.archiveBoxId?.trim()
    || student.archiveBoxLabel?.trim()
    || student.archiveLocation?.trim(),
  );
}

/** Returning intake: only assign a new drawer when the student is active but unassigned. */
export function returningStudentNeedsNewDrawer(student: {
  archived?: boolean;
  status?: string;
  cabinet?: string;
  archiveBoxId?: string;
  archiveBoxLabel?: string;
  archiveLocation?: string;
}): boolean {
  if (studentHasArchiveBoxLocation(student) || studentIsArchived(student)) {
    return false;
  }
  return !student.cabinet;
}
