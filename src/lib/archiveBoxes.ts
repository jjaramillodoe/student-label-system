import { ObjectId, Db } from 'mongodb';
import type { ArchiveBox, PhysicalArchiveBox } from '@/types/cabinet';

export type ArchiveBoxLabelOptions = {
  cabinetName: string;
  cabinetIdentifier?: string | null;
  schoolYear: string;
  boxNumber: number;
  drawerName?: string;
};

/** Build a human-readable archive box label using cabinet id + drawer letter. */
export function buildArchiveBoxLabel(opts: ArchiveBoxLabelOptions): string {
  const idPart = opts.cabinetIdentifier?.trim() ? ` (${opts.cabinetIdentifier.trim()})` : '';
  const drawerPart = opts.drawerName?.trim() ? ` — ${opts.drawerName.trim()}` : '';
  return `${opts.cabinetName}${idPart} ${opts.schoolYear} Box ${opts.boxNumber}${drawerPart}`;
}

/** Map box index to a drawer when boxes are spread across cabinet drawers. */
export function getDrawerForBoxIndex(
  boxNumber: number,
  drawerNames: string[],
  totalBoxes: number,
): string | undefined {
  if (!drawerNames.length || totalBoxes <= 0) return undefined;
  const boxesPerDrawer = Math.max(1, Math.ceil(totalBoxes / drawerNames.length));
  const drawerIdx = Math.min(Math.floor((boxNumber - 1) / boxesPerDrawer), drawerNames.length - 1);
  return drawerNames[drawerIdx];
}

export type BuildPhysicalBoxesOptions = {
  cabinetName: string;
  cabinetIdentifier?: string | null;
  schoolYear: string;
  drawerNames?: string[];
};

/** Expand box-type rows into individual physical boxes with unique IDs. */
export function buildPhysicalBoxes(
  boxTypes: ArchiveBox[],
  opts: BuildPhysicalBoxesOptions,
): PhysicalArchiveBox[] {
  const totalBoxes = boxTypes.reduce((sum, b) => sum + b.quantity, 0);
  const drawerNames = opts.drawerNames?.filter(Boolean) ?? [];
  const physical: PhysicalArchiveBox[] = [];
  let boxNumber = 1;

  for (const { quantity, filesPerBox } of boxTypes) {
    for (let i = 0; i < quantity; i++) {
      const drawerName = getDrawerForBoxIndex(boxNumber, drawerNames, totalBoxes);
      physical.push({
        _id: new ObjectId().toString(),
        label: buildArchiveBoxLabel({ ...opts, boxNumber, drawerName }),
        boxNumber,
        drawerName,
        filesPerBox,
        maxCapacity: filesPerBox,
        currentCount: 0,
      });
      boxNumber++;
    }
  }

  return physical;
}

/** Refresh labels on existing boxes (keeps IDs) — used when syncing older archives. */
export function relabelPhysicalBoxes(
  boxes: PhysicalArchiveBox[],
  opts: BuildPhysicalBoxesOptions,
): PhysicalArchiveBox[] {
  const totalBoxes = boxes.length;
  const drawerNames = opts.drawerNames?.filter(Boolean) ?? [];

  return boxes.map(box => {
    const drawerName = getDrawerForBoxIndex(box.boxNumber, drawerNames, totalBoxes);
    return {
      ...box,
      drawerName,
      label: buildArchiveBoxLabel({ ...opts, boxNumber: box.boxNumber, drawerName }),
    };
  });
}

export function totalBoxCapacity(boxes: PhysicalArchiveBox[]) {
  return boxes.reduce((sum, b) => sum + b.maxCapacity, 0);
}

type AssignableStudent = { _id: ObjectId; drawer?: string };

function assignStudentsSequentially<T extends AssignableStudent>(
  students: T[],
  boxes: PhysicalArchiveBox[],
): Map<string, PhysicalArchiveBox> {
  const assignments = new Map<string, PhysicalArchiveBox>();
  let boxIndex = 0;

  for (const student of students) {
    while (boxIndex < boxes.length && boxes[boxIndex].currentCount >= boxes[boxIndex].maxCapacity) {
      boxIndex++;
    }
    if (boxIndex >= boxes.length) {
      throw new Error(
        `Not enough box capacity. ${students.length} student files need ${students.length} slots but boxes only hold ${totalBoxCapacity(boxes)}.`,
      );
    }

    const box = boxes[boxIndex];
    box.currentCount += 1;
    assignments.set(student._id.toString(), box);
  }

  return assignments;
}

/** Prefer assigning students to boxes that match their drawer name. */
export function assignStudentsToBoxes<T extends AssignableStudent>(
  students: T[],
  boxes: PhysicalArchiveBox[],
  drawerIdToName?: Map<string, string>,
): Map<string, PhysicalArchiveBox> {
  if (!drawerIdToName?.size || !boxes.some(b => b.drawerName)) {
    return assignStudentsSequentially(students, boxes);
  }

  const assignments = new Map<string, PhysicalArchiveBox>();
  const overflow: T[] = [];

  const byDrawer = new Map<string, T[]>();
  for (const student of students) {
    const drawerName = student.drawer
      ? drawerIdToName.get(student.drawer) || student.drawer
      : '';
    if (drawerName) {
      const list = byDrawer.get(drawerName) ?? [];
      list.push(student);
      byDrawer.set(drawerName, list);
    } else {
      overflow.push(student);
    }
  }

  for (const [drawerName, drawerStudents] of byDrawer) {
    const drawerBoxes = boxes.filter(b => b.drawerName === drawerName);
    const targetBoxes = drawerBoxes.length > 0 ? drawerBoxes : boxes;
    let boxIndex = 0;

    for (const student of drawerStudents) {
      while (
        boxIndex < targetBoxes.length &&
        targetBoxes[boxIndex].currentCount >= targetBoxes[boxIndex].maxCapacity
      ) {
        boxIndex++;
      }
      if (boxIndex >= targetBoxes.length) {
        overflow.push(student);
        continue;
      }
      const box = targetBoxes[boxIndex];
      box.currentCount += 1;
      assignments.set(student._id.toString(), box);
    }
  }

  if (overflow.length > 0) {
    const spill = assignStudentsSequentially(
      overflow.filter(s => !assignments.has(s._id.toString())),
      boxes,
    );
    spill.forEach((box, id) => assignments.set(id, box));
  }

  return assignments;
}

function buildDrawerIdToName(
  drawers: Array<{ _id?: string; name?: string }> | undefined,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const drawer of drawers ?? []) {
    if (drawer._id && drawer.name) {
      map.set(drawer._id.toString(), drawer.name);
      map.set(drawer._id, drawer.name);
      map.set(drawer.name, drawer.name);
    }
  }
  return map;
}

async function loadArchiveBoxContext(
  db: Db,
  cabinetId: string,
  archiveRecordId: string,
  meta: { schoolYear: string },
) {
  const [cabinet, archiveRecord] = await Promise.all([
    db.collection('cabinets').findOne({ _id: new ObjectId(cabinetId) }),
    db.collection('cabinet_archives').findOne({ _id: new ObjectId(archiveRecordId) }),
  ]);

  const labelOpts: BuildPhysicalBoxesOptions = {
    cabinetName: archiveRecord?.cabinetName || cabinet?.name || 'Cabinet',
    cabinetIdentifier: archiveRecord?.cabinetIdentifier ?? cabinet?.identifier ?? null,
    schoolYear: meta.schoolYear,
    drawerNames: (cabinet?.drawers ?? []).map((d: { name?: string }) => d.name).filter(Boolean),
  };

  return {
    cabinet,
    labelOpts,
    drawerIdToName: buildDrawerIdToName(cabinet?.drawers),
  };
}

/** Move students into archive boxes and free drawer capacity. */
export async function moveCabinetStudentsToArchiveBoxes(
  db: Db,
  cabinetId: string,
  archiveRecordId: string,
  physicalBoxes: PhysicalArchiveBox[],
  meta: {
    location: string;
    schoolYear: string;
    archivedAt: string;
  },
) {
  const students = await db
    .collection('students')
    .find({ cabinet: cabinetId })
    .toArray();

  return applyArchiveBoxAssignments(db, cabinetId, archiveRecordId, physicalBoxes, meta, students);
}

/** Count students still needing box assignment for an archived cabinet. */
export async function countPendingArchiveAssignments(
  db: Db,
  cabinetId: string,
  archiveRecordId: string,
  physicalBoxes: PhysicalArchiveBox[] = [],
) {
  const boxIds = physicalBoxes.map(b => b._id);
  return db.collection('students').countDocuments({
    $or: [
      { cabinet: cabinetId },
      {
        archiveId: archiveRecordId,
        $or: [
          { archiveBoxId: { $exists: false } },
          { archiveBoxId: null },
          { archiveBoxId: '' },
        ],
      },
      ...(boxIds.length > 0
        ? [{ archiveBoxId: { $in: boxIds }, archiveBoxLabel: { $exists: false } }]
        : []),
    ],
  });
}

/** Re-sync all students for an archived cabinet into boxes. */
export async function syncArchiveStudentsToBoxes(
  db: Db,
  cabinetId: string,
  archiveRecordId: string,
  physicalBoxes: PhysicalArchiveBox[],
  meta: {
    location: string;
    schoolYear: string;
    archivedAt: string;
  },
) {
  const boxIds = physicalBoxes.map(b => b._id);
  const students = await db
    .collection('students')
    .find({
      $or: [
        { cabinet: cabinetId },
        { archiveId: archiveRecordId },
        ...(boxIds.length > 0 ? [{ archiveBoxId: { $in: boxIds } }] : []),
      ],
    })
    .sort({ lastName: 1, firstName: 1 })
    .toArray();

  return applyArchiveBoxAssignments(db, cabinetId, archiveRecordId, physicalBoxes, meta, students);
}

async function applyArchiveBoxAssignments(
  db: Db,
  cabinetId: string,
  archiveRecordId: string,
  physicalBoxes: PhysicalArchiveBox[],
  meta: {
    location: string;
    schoolYear: string;
    archivedAt: string;
  },
  students: AssignableStudent[],
) {
  const { cabinet, labelOpts, drawerIdToName } = await loadArchiveBoxContext(
    db,
    cabinetId,
    archiveRecordId,
    meta,
  );

  const labeledBoxes = relabelPhysicalBoxes(
    physicalBoxes.map(b => ({ ...b, currentCount: 0 })),
    labelOpts,
  );

  if (students.length === 0) {
    await db.collection('cabinet_archives').updateOne(
      { _id: new ObjectId(archiveRecordId) },
      { $set: { physicalBoxes: labeledBoxes } },
    );
    return { assigned: 0, physicalBoxes: labeledBoxes };
  }

  const boxes = labeledBoxes.map(b => ({ ...b, currentCount: 0 }));
  const assignments = assignStudentsToBoxes(students, boxes, drawerIdToName);
  const now = meta.archivedAt;

  const bulkOps = students.map(student => {
    const box = assignments.get(student._id.toString())!;
    return {
      updateOne: {
        filter: { _id: student._id },
        update: {
          $set: {
            archived: true,
            status: 'Archived',
            archiveId: archiveRecordId,
            archiveBoxId: box._id,
            archiveBoxLabel: box.label,
            archiveLocation: meta.location,
            archiveSchoolYear: meta.schoolYear,
            archivedAt: now,
            updatedAt: now,
          },
          $unset: { cabinet: '', drawer: '' },
        },
      },
    };
  });

  if (bulkOps.length > 0) {
    await db.collection('students').bulkWrite(bulkOps);
  }

  if (cabinet?.drawers) {
    await db.collection('cabinets').updateOne(
      { _id: new ObjectId(cabinetId) },
      {
        $set: {
          currentCount: 0,
          drawers: cabinet.drawers.map((d: { _id: string; name: string; capacity: number }) => ({
            ...d,
            currentCount: 0,
          })),
          updatedAt: now,
        },
      },
    );
  }

  await db.collection('cabinet_archives').updateOne(
    { _id: new ObjectId(archiveRecordId) },
    { $set: { physicalBoxes: boxes, studentCountAtArchive: students.length } },
  );

  return { assigned: students.length, physicalBoxes: boxes };
}

type ArchiveRecordDoc = {
  _id: ObjectId;
  cabinetName: string;
  cabinetIdentifier?: string | null;
  school?: string | null;
  schoolYear: string;
  location: string;
  archiveDate?: string;
  physicalBoxes?: PhysicalArchiveBox[];
};

function findPhysicalBoxInRecord(record: ArchiveRecordDoc, boxId: string) {
  return (record.physicalBoxes || []).find((b) => String(b._id) === boxId);
}

/** Resolve a public archive box id to its archive record and box row. */
export async function findArchiveBoxByPublicId(db: Db, boxId: string) {
  const archives = db.collection<ArchiveRecordDoc>('cabinet_archives');

  let archiveRecord = await archives.findOne({ 'physicalBoxes._id': boxId });
  let box = archiveRecord ? findPhysicalBoxInRecord(archiveRecord, boxId) : undefined;

  if (!box && ObjectId.isValid(boxId)) {
    const objectId = new ObjectId(boxId);
    archiveRecord = await archives.findOne({ 'physicalBoxes._id': objectId });
    box = archiveRecord ? findPhysicalBoxInRecord(archiveRecord, boxId) : undefined;
  }

  if (!box) {
    const student = await db.collection('students').findOne(
      { archiveBoxId: boxId },
      { projection: { archiveId: 1 } },
    );
    if (student?.archiveId && ObjectId.isValid(String(student.archiveId))) {
      archiveRecord = await archives.findOne({ _id: new ObjectId(String(student.archiveId)) });
      box = archiveRecord ? findPhysicalBoxInRecord(archiveRecord, boxId) : undefined;
    }
  }

  if (!archiveRecord || !box) return null;
  return { archiveRecord, box };
}
