/** Helpers for printable cabinet / drawer / section storage labels. */

import {
  formatDrawerSectionLabel,
  getDrawerSectionBreakdown,
  SECTIONS_PER_DRAWER,
} from '@/lib/drawerSections';

export type StorageLabelKind = 'cabinet' | 'drawer' | 'section';

export type StorageLabelItem = {
  id: string;
  kind: StorageLabelKind;
  title: string;
  subtitle: string;
  line3?: string;
  qrValue: string;
  school?: string;
};

export function formatCabinetDisplayName(cabinet: {
  name: string;
  identifier?: string | null;
}) {
  return cabinet.identifier ? `${cabinet.name} (${cabinet.identifier})` : cabinet.name;
}

/** Build printable labels for a cabinet (cabinet face + each drawer + 8 sections). */
export function buildCabinetStorageLabels(cabinet: {
  _id: string;
  name: string;
  identifier?: string | null;
  school?: string | null;
  drawers: Array<{
    _id?: string;
    name: string;
    capacity?: number;
    currentCount?: number;
  }>;
}): StorageLabelItem[] {
  const cabinetName = formatCabinetDisplayName(cabinet);
  const school = cabinet.school || undefined;
  const labels: StorageLabelItem[] = [
    {
      id: `cab-${cabinet._id}`,
      kind: 'cabinet',
      title: cabinetName,
      subtitle: school ? `School: ${school}` : 'Active filing cabinet',
      line3: `${cabinet.drawers.length} drawer(s)`,
      qrValue: `CABINET|${cabinet._id}|${cabinetName}`,
      school,
    },
  ];

  for (const drawer of cabinet.drawers) {
    const drawerId = drawer._id || drawer.name;
    labels.push({
      id: `drawer-${cabinet._id}-${drawerId}`,
      kind: 'drawer',
      title: drawer.name,
      subtitle: cabinetName,
      line3: `${drawer.currentCount || 0}/${drawer.capacity || 0} files · ${SECTIONS_PER_DRAWER} sections`,
      qrValue: `DRAWER|${cabinet._id}|${drawerId}|${drawer.name}`,
      school,
    });

    const sections = getDrawerSectionBreakdown(
      drawer.currentCount || 0,
      drawer.capacity || 0,
    );
    for (const section of sections) {
      labels.push({
        id: `sec-${cabinet._id}-${drawerId}-${section.number}`,
        kind: 'section',
        title: formatDrawerSectionLabel(section.number),
        subtitle: `${cabinetName} · ${drawer.name}`,
        line3: `Capacity ${section.capacity} files`,
        qrValue: `SECTION|${cabinet._id}|${drawerId}|${section.number}|${section.label}`,
        school,
      });
    }
  }

  return labels;
}
