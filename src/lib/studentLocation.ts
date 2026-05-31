/** Fields used to resolve where a student file is stored. */
export type StorageStudent = {
  archived?: boolean;
  status?: string;
  cabinet?: string;
  drawer?: string;
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
  /** Label for primary line in compact table view */
  primaryLabel: 'Box' | 'Cab';
  /** Label for secondary line in compact table view */
  secondaryLabel: 'Location' | 'Draw';
};

export function getStudentStorageDisplay(
  student: StorageStudent,
  cabinetMap: Record<string, string> = {},
  drawerMap: Record<string, string> = {},
): StudentStorageDisplay {
  const isArchived = Boolean(student.archived || student.status === 'Archived');

  if (isArchived) {
    if (student.archiveBoxLabel || student.archiveLocation) {
      return {
        isArchived: true,
        primary: student.archiveBoxLabel || 'Archive box',
        secondary: student.archiveLocation || student.archiveSchoolYear || '—',
        primaryLabel: 'Box',
        secondaryLabel: 'Location',
      };
    }

    const cabinetName = cabinetMap[student.cabinet || ''] || student.cabinet || '';
    const drawerName = drawerMap[student.drawer || ''] || student.drawer || '';
    if (cabinetName || drawerName) {
      return {
        isArchived: true,
        primary: cabinetName || '—',
        secondary: drawerName || '—',
        primaryLabel: 'Cab',
        secondaryLabel: 'Draw',
      };
    }

    return {
      isArchived: true,
      primary: 'No box assigned',
      secondary: 'Move to boxes on archived cabinet',
      primaryLabel: 'Box',
      secondaryLabel: 'Location',
    };
  }

  return {
    isArchived: false,
    primary: cabinetMap[student.cabinet || ''] || student.cabinet || '—',
    secondary: drawerMap[student.drawer || ''] || student.drawer || '—',
    primaryLabel: 'Cab',
    secondaryLabel: 'Draw',
  };
}
