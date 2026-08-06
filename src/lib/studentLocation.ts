import { normalizeMongoId } from '@/lib/utils';

/** Fields used to resolve where a student file is stored. */
export type StorageStudent = {
  archived?: boolean;
  status?: string;
  cabinet?: string;
  drawer?: string;
  /** Auto-assigned drawer section, e.g. "Section 01" (hidden from intake) */
  drawerSection?: string;
  /** Resolved display name from API enrichment */
  cabinetName?: string;
  drawerName?: string;
  archiveBoxLabel?: string;
  archiveLocation?: string;
  archiveSchoolYear?: string;
  archiveBoxId?: string;
};

export type StudentStorageDisplay = {
  isArchived: boolean;
  /** Primary line: box label, cabinet name, or fallback */
  primary: string;
  /** Secondary line: storage location, drawer name, or school year */
  secondary: string;
  /** Optional third line for Data Lead views: Section 01, etc. */
  section: string | null;
  /** Label for primary line in compact table view */
  primaryLabel: 'Box' | 'Cab';
  /** Label for secondary line in compact table view */
  secondaryLabel: 'Location' | 'Draw';
};

function mapLookup(map: Record<string, string>, raw: unknown): string | undefined {
  const key = normalizeMongoId(raw) ?? (raw != null && raw !== '' ? String(raw) : '');
  if (!key) return undefined;
  const hit = map[key];
  return hit || undefined;
}

function resolveStorageName(
  map: Record<string, string>,
  raw: unknown,
  enrichedName?: string | null,
): string {
  const fromMap = mapLookup(map, raw);
  if (fromMap) return fromMap;
  if (enrichedName?.trim()) return enrichedName.trim();
  const key = normalizeMongoId(raw) ?? (raw != null && raw !== '' ? String(raw) : '');
  return key || '—';
}

export function getStudentStorageDisplay(
  student: StorageStudent,
  cabinetMap: Record<string, string> = {},
  drawerMap: Record<string, string> = {},
  options?: { showSection?: boolean },
): StudentStorageDisplay {
  const isArchived = Boolean(student.archived || student.status === 'Archived');
  const section =
    options?.showSection && !isArchived && student.drawerSection?.trim()
      ? student.drawerSection.trim()
      : null;

  if (isArchived) {
    if (student.archiveBoxLabel || student.archiveLocation) {
      return {
        isArchived: true,
        primary: student.archiveBoxLabel || 'Archive box',
        secondary: student.archiveLocation || student.archiveSchoolYear || '—',
        section: null,
        primaryLabel: 'Box',
        secondaryLabel: 'Location',
      };
    }

    const cabinetName = resolveStorageName(cabinetMap, student.cabinet, student.cabinetName);
    const drawerName = resolveStorageName(drawerMap, student.drawer, student.drawerName);
    if ((cabinetName && cabinetName !== '—') || (drawerName && drawerName !== '—')) {
      return {
        isArchived: true,
        primary: cabinetName !== '—' ? cabinetName : '—',
        secondary: drawerName !== '—' ? drawerName : '—',
        section: null,
        primaryLabel: 'Cab',
        secondaryLabel: 'Draw',
      };
    }

    return {
      isArchived: true,
      primary: 'No box assigned',
      secondary: 'Move to boxes on archived cabinet',
      section: null,
      primaryLabel: 'Box',
      secondaryLabel: 'Location',
    };
  }

  return {
    isArchived: false,
    primary: resolveStorageName(cabinetMap, student.cabinet, student.cabinetName),
    secondary: resolveStorageName(drawerMap, student.drawer, student.drawerName),
    section,
    primaryLabel: 'Cab',
    secondaryLabel: 'Draw',
  };
}
