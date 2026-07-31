/**
 * Cabinet fill-rate forecast from recent assignments (server-only).
 */

import type { Db } from 'mongodb';

export type CabinetFillForecast = {
  cabinetId: string;
  windowDays: number;
  assignedInWindow: number;
  available: number;
  avgPerDay: number;
  weeksLeft: number | null;
};

export async function computeCabinetFillForecast(
  db: Db,
  cabinet: {
    _id: string | { toString(): string };
    currentCount?: number;
    totalCapacity?: number;
  },
  windowDays = 30,
): Promise<CabinetFillForecast> {
  const cabinetId = String(cabinet._id);
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
  const available = Math.max(
    0,
    (Number(cabinet.totalCapacity) || 0) - (Number(cabinet.currentCount) || 0),
  );

  const newAssigned = await db.collection('students').countDocuments({
    cabinet: cabinetId,
    createdAt: { $gte: since },
    $or: [{ archived: { $ne: true } }, { archived: { $exists: false } }],
  });

  // Moves into this cabinet (transfer history)
  const moveEvents = await db
    .collection('cabinet_move_events')
    .find({ createdAt: { $gte: since } })
    .project({ students: 1 })
    .toArray();

  let movedIn = 0;
  for (const ev of moveEvents) {
    for (const s of ev.students || []) {
      if (String(s?.to?.cabinetId || '') === cabinetId) movedIn += 1;
    }
  }

  // Prefer the larger signal so we don't double-count intake that also logged a move
  const assignedInWindow = Math.max(newAssigned, movedIn);
  const avgPerDay = assignedInWindow / windowDays;
  const weeksLeft =
    avgPerDay > 0 ? Math.floor(available / (avgPerDay * 7)) : available > 0 ? null : 0;

  return {
    cabinetId,
    windowDays,
    assignedInWindow,
    available,
    avgPerDay,
    weeksLeft,
  };
}
