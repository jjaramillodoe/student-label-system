import type { Db } from 'mongodb';
import { normalizeMongoId } from '@/lib/utils';

export type CabinetDrawerLookup = {
  name: string;
  drawers: Map<string, string>;
};

/** Build id→name maps for cabinets and drawers (also keyed by display name). */
export function buildCabinetDrawerLookup(
  cabinets: Array<{
    _id?: unknown;
    name?: string;
    label?: string;
    identifier?: string;
    drawers?: Array<{ _id?: unknown; id?: unknown; name?: string }>;
  }>,
): {
  byCabinetId: Map<string, CabinetDrawerLookup>;
  cabinetMap: Record<string, string>;
  drawerMap: Record<string, string>;
} {
  const byCabinetId = new Map<string, CabinetDrawerLookup>();
  const cabinetMap: Record<string, string> = {};
  const drawerMap: Record<string, string> = {};

  for (const c of cabinets) {
    const id = normalizeMongoId(c._id) ?? String(c._id ?? '');
    if (!id) continue;
    const name = (c.name || c.label || c.identifier || id).trim() || id;
    const drawers = new Map<string, string>();

    for (const d of c.drawers || []) {
      const drawerId = normalizeMongoId(d._id) ?? normalizeMongoId(d.id) ?? String(d._id ?? d.id ?? '');
      const drawerName = (d.name || drawerId).trim() || drawerId;
      if (!drawerId) continue;
      drawers.set(drawerId, drawerName);
      drawerMap[drawerId] = drawerName;
      if (d.name) drawers.set(d.name, drawerName);
    }

    const entry = { name, drawers };
    byCabinetId.set(id, entry);
    cabinetMap[id] = name;
    if (c.name) {
      byCabinetId.set(c.name, entry);
      cabinetMap[c.name] = name;
    }
    if (c.label) {
      byCabinetId.set(c.label, entry);
      cabinetMap[c.label] = name;
    }
    if (c.identifier) {
      cabinetMap[c.identifier] = name;
    }
  }

  return { byCabinetId, cabinetMap, drawerMap };
}

export function resolveCabinetAndDrawerNames(
  cabinetRaw: unknown,
  drawerRaw: unknown,
  byCabinetId: Map<string, CabinetDrawerLookup>,
): { cabinetName: string; drawerName: string } {
  const cabinetKey = normalizeMongoId(cabinetRaw) ?? (cabinetRaw != null ? String(cabinetRaw) : '');
  if (!cabinetKey) return { cabinetName: '', drawerName: '' };

  const entry = byCabinetId.get(cabinetKey);
  const drawerKey = normalizeMongoId(drawerRaw) ?? (drawerRaw != null ? String(drawerRaw) : '');

  if (!entry) {
    return {
      cabinetName: cabinetKey,
      drawerName: drawerKey,
    };
  }

  let drawerName = drawerKey;
  if (drawerKey) {
    drawerName = entry.drawers.get(drawerKey) || drawerKey;
  }

  return { cabinetName: entry.name, drawerName };
}

export async function loadCabinetDrawerLookup(db: Db) {
  const cabinets = await db.collection('cabinets').find({}).toArray();
  return buildCabinetDrawerLookup(cabinets);
}

/** Attach human-readable cabinet/drawer names onto student records. */
export function enrichStudentsWithCabinetNames<T extends Record<string, unknown>>(
  students: T[],
  byCabinetId: Map<string, CabinetDrawerLookup>,
): Array<T & { _id: string; cabinetName: string; drawerName: string }> {
  return students.map((s) => {
    const { cabinetName, drawerName } = resolveCabinetAndDrawerNames(
      s.cabinet,
      s.drawer,
      byCabinetId,
    );
    const id = normalizeMongoId(s._id) ?? String(s._id ?? '');
    return {
      ...s,
      _id: id,
      cabinetName,
      drawerName,
    };
  });
}
