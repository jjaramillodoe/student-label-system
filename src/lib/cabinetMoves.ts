/**
 * Shared student → drawer moves with transfer history.
 * Server-only (Mongo + audit).
 */

import type { ClientSession, Db, ObjectId } from 'mongodb';
import { ObjectId as OID, MongoServerError } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { assignDrawerSection } from '@/lib/drawerSections';
import { findNextAvailableSlot, isActiveCabinet } from '@/lib/cabinets';
import type { Cabinet } from '@/types/cabinet';

export type MoveActor = {
  name?: string | null;
  email?: string | null;
  role?: string | null;
  school?: string | null;
};

export type MoveLocation = {
  cabinetId: string | null;
  cabinetName: string | null;
  drawerId: string | null;
  drawerName: string | null;
  drawerSection?: string | null;
};

function isValidObjectId(id: string) {
  try {
    new OID(id);
    return true;
  } catch {
    return false;
  }
}

function actorPayload(user?: MoveActor | null) {
  return user
    ? {
        name: user.name || null,
        email: user.email || null,
        role: user.role || null,
        school: user.school || null,
      }
    : null;
}

async function resolveLocation(
  db: Db,
  cabinetId?: string | null,
  drawerId?: string | null,
  drawerSection?: string | null,
): Promise<MoveLocation> {
  if (!cabinetId || !isValidObjectId(cabinetId)) {
    return {
      cabinetId: cabinetId || null,
      cabinetName: null,
      drawerId: drawerId || null,
      drawerName: null,
      drawerSection: drawerSection || null,
    };
  }
  const cabinet = await db.collection('cabinets').findOne({ _id: new OID(cabinetId) });
  const drawer = (cabinet?.drawers || []).find((d: { _id?: string }) => d._id === drawerId);
  return {
    cabinetId,
    cabinetName: cabinet
      ? cabinet.identifier
        ? `${cabinet.name} (${cabinet.identifier})`
        : cabinet.name
      : null,
    drawerId: drawerId || null,
    drawerName: drawer?.name || null,
    drawerSection: drawerSection || null,
  };
}

export async function logCabinetMoveEvent(
  db: Db,
  event: {
    students: Array<{
      _id: string;
      studentId?: string;
      firstName?: string;
      lastName?: string;
      from: MoveLocation;
      to: MoveLocation;
    }>;
    source?: string;
    note?: string;
    user?: MoveActor | null;
  },
) {
  const now = new Date().toISOString();
  const doc = {
    type: 'move',
    studentCount: event.students.length,
    students: event.students,
    source: event.source || 'bulk-move',
    note: event.note || null,
    user: actorPayload(event.user),
    createdAt: now,
  };
  const insert = await db.collection('cabinet_move_events').insertOne(doc);

  // Also mirror into audit_logs for the existing Audit viewer
  await db.collection('audit_logs').insertOne({
    action: 'Move Students',
    student: event.students.map((s) => ({
      studentId: s.studentId,
      firstName: s.firstName,
      lastName: s.lastName,
      _id: s._id,
      from: s.from,
      to: s.to,
    })),
    source: event.source,
    note: event.note,
    moveEventId: String(insert.insertedId),
    time: now,
    user: actorPayload(event.user),
  });

  return insert.insertedId;
}

export async function moveStudentsToDrawer(
  db: Db,
  params: {
    studentIds: string[];
    targetCabinetId: string;
    targetDrawerId: string;
    user?: MoveActor | null;
    source?: string;
    note?: string;
    schoolScope?: string | null;
  },
): Promise<{
  ok: boolean;
  moved: number;
  errors: string[];
  message: string;
  error?: string;
  status?: number;
}> {
  const { studentIds, targetCabinetId, targetDrawerId } = params;

  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    return { ok: false, moved: 0, errors: [], message: '', error: 'Select at least one student to move', status: 400 };
  }
  if (!targetCabinetId || !targetDrawerId || !isValidObjectId(targetCabinetId)) {
    return { ok: false, moved: 0, errors: [], message: '', error: 'Target cabinet and drawer are required', status: 400 };
  }
  const invalidStudentId = studentIds.find((id) => !isValidObjectId(id));
  if (invalidStudentId) {
    return { ok: false, moved: 0, errors: [], message: '', error: `Invalid student id: ${invalidStudentId}`, status: 400 };
  }

  const targetCabinet = await db.collection('cabinets').findOne({ _id: new OID(targetCabinetId) });
  if (!targetCabinet) {
    return { ok: false, moved: 0, errors: [], message: '', error: 'Target cabinet not found', status: 404 };
  }
  if (!isActiveCabinet(targetCabinet as unknown as Cabinet)) {
    return {
      ok: false,
      moved: 0,
      errors: [],
      message: '',
      error: 'Target cabinet is archived — pick an active cabinet',
      status: 400,
    };
  }
  if (params.schoolScope && targetCabinet.school !== params.schoolScope) {
    return { ok: false, moved: 0, errors: [], message: '', error: 'Target cabinet is outside your school', status: 403 };
  }

  const targetDrawer = (targetCabinet.drawers || []).find(
    (drawer: { _id?: string; locked?: boolean }) => drawer._id === targetDrawerId,
  );
  if (!targetDrawer) {
    return { ok: false, moved: 0, errors: [], message: '', error: 'Target drawer not found in cabinet', status: 404 };
  }
  if (targetDrawer.locked) {
    return {
      ok: false,
      moved: 0,
      errors: [],
      message: '',
      error: 'Target drawer is locked (do not fill). Unlock it or pick another drawer.',
      status: 400,
    };
  }

  const available = (targetDrawer.capacity || 0) - (targetDrawer.currentCount || 0);
  if (available < studentIds.length) {
    return {
      ok: false,
      moved: 0,
      errors: [],
      message: '',
      error: `Target drawer only has ${available} available space(s) for ${studentIds.length} selected student(s)`,
      status: 400,
    };
  }

  const studentObjectIds = studentIds.map((id) => new OID(id));
  const studentQuery: Record<string, unknown> = { _id: { $in: studentObjectIds } };
  if (params.schoolScope) studentQuery.school = params.schoolScope;

  const students = await db.collection('students').find(studentQuery).toArray();
  if (students.length !== studentIds.length) {
    return {
      ok: false,
      moved: 0,
      errors: [],
      message: '',
      error: 'Some students were not found or are outside your school',
      status: 400,
    };
  }

  const toBase = await resolveLocation(db, targetCabinetId, targetDrawerId, null);
  const cabinetLabel = targetCabinet.identifier
    ? `${targetCabinet.name} (${targetCabinet.identifier})`
    : targetCabinet.name;

  type MoveSnapshot = {
    _id: string;
    studentId?: string;
    firstName?: string;
    lastName?: string;
    from: MoveLocation;
    to: MoveLocation;
  };

  const runMoves = async (session?: ClientSession) => {
    let moved = 0;
    const errors: string[] = [];
    let nextIndexInDrawer = targetDrawer.currentCount || 0;
    const moveSnapshots: MoveSnapshot[] = [];
    const opts = session ? { session } : undefined;

    for (const student of students) {
      try {
        const from = await resolveLocation(
          db,
          student.cabinet,
          student.drawer,
          student.drawerSection,
        );

        if (student.cabinet && student.drawer && isValidObjectId(String(student.cabinet))) {
          await db.collection('cabinets').updateOne(
            { _id: new OID(String(student.cabinet)), 'drawers._id': student.drawer },
            { $inc: { 'drawers.$.currentCount': -1, currentCount: -1 } },
            opts,
          );
        }

        const drawerSection = assignDrawerSection(nextIndexInDrawer, targetDrawer.capacity || 400);
        nextIndexInDrawer += 1;

        await db.collection('students').updateOne(
          { _id: student._id },
          {
            $set: {
              cabinet: targetCabinetId,
              drawer: targetDrawerId,
              drawerSection,
              updatedAt: new Date().toISOString(),
            },
          },
          opts,
        );

        await db.collection('cabinets').updateOne(
          { _id: new OID(targetCabinetId), 'drawers._id': targetDrawerId },
          { $inc: { 'drawers.$.currentCount': 1, currentCount: 1 } },
          opts,
        );

        moveSnapshots.push({
          _id: String(student._id),
          studentId: student.studentId || student.labelId,
          firstName: student.firstName,
          lastName: student.lastName,
          from,
          to: { ...toBase, drawerSection },
        });
        moved++;
      } catch (error) {
        errors.push(
          `Failed to move ${student.studentId || student._id}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        );
        if (session) throw error;
      }
    }

    return { moved, errors, moveSnapshots };
  };

  const finish = async (result: {
    moved: number;
    errors: string[];
    moveSnapshots: MoveSnapshot[];
  }) => {
    if (result.moveSnapshots.length > 0) {
      await logCabinetMoveEvent(db, {
        students: result.moveSnapshots,
        source: params.source || 'bulk-move',
        note: params.note,
        user: params.user,
      });
    }
    return {
      ok: true as const,
      moved: result.moved,
      errors: result.errors,
      message: `Moved ${result.moved} student${result.moved === 1 ? '' : 's'} to ${cabinetLabel} / ${targetDrawer.name}`,
    };
  };

  const txnUnsupported = (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err ?? '');
    if (/replica set|Transaction numbers|IllegalOperation|transactions are not supported/i.test(msg)) {
      return true;
    }
    return err instanceof MongoServerError && (err.code === 20 || err.codeName === 'IllegalOperation');
  };

  try {
    const client = await clientPromise;
    const session = client.startSession();
    try {
      let result = { moved: 0, errors: [] as string[], moveSnapshots: [] as MoveSnapshot[] };
      await session.withTransaction(async () => {
        result = await runMoves(session);
      });
      return finish(result);
    } finally {
      await session.endSession();
    }
  } catch (err) {
    if (!txnUnsupported(err)) {
      console.warn('[cabinetMoves] transaction failed, falling back', err);
    }
    return finish(await runMoves());
  }
}

export async function assignStudentsToNextSlot(
  db: Db,
  params: {
    studentIds: string[];
    user?: MoveActor | null;
    source?: string;
    note?: string;
    schoolScope?: string | null;
  },
) {
  const studentObjectIds = params.studentIds
    .filter((id) => isValidObjectId(id))
    .map((id) => new OID(id));
  const students = await db
    .collection('students')
    .find({ _id: { $in: studentObjectIds } })
    .project({ school: 1 })
    .toArray();
  const schools = [
    ...new Set(
      students
        .map((s) => String(s.school || '').trim())
        .filter(Boolean),
    ),
  ];
  const preferredSchool = params.schoolScope || (schools.length === 1 ? schools[0] : null);

  const cabinetQuery: Record<string, unknown> = {
    $or: [{ status: 'Active' }, { status: { $exists: false } }, { status: null }],
  };
  if (preferredSchool) cabinetQuery.school = preferredSchool;

  const cabinets = (await db.collection('cabinets').find(cabinetQuery).toArray()) as unknown as Cabinet[];
  // Ensure string ids for slot helpers
  for (const c of cabinets) {
    c._id = String(c._id);
    c.drawers = (c.drawers || []).map((d) => ({ ...d, _id: String(d._id) }));
  }
  const slot = findNextAvailableSlot(cabinets);
  if (!slot) {
    return {
      ok: false as const,
      moved: 0,
      errors: [] as string[],
      message: '',
      error: preferredSchool
        ? `No available drawer space in active cabinets for ${preferredSchool}`
        : 'No available drawer space in active cabinets',
      status: 400,
    };
  }

  if (slot.spacesLeft < params.studentIds.length) {
    return {
      ok: false as const,
      moved: 0,
      errors: [] as string[],
      message: '',
      error: `Next open drawer (${slot.cabinet.name} / ${slot.drawer.name}) only has ${slot.spacesLeft} space(s)`,
      status: 400,
    };
  }

  return moveStudentsToDrawer(db, {
    studentIds: params.studentIds,
    targetCabinetId: String(slot.cabinet._id),
    targetDrawerId: String(slot.drawer._id),
    user: params.user,
    source: params.source || 'assign-next-slot',
    note: params.note || `Auto-assigned to next open slot`,
    schoolScope: params.schoolScope,
  });
}

export type { ObjectId };
