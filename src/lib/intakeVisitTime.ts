import { epeVisitsTotalMinutes } from '@/lib/epeClock';

/** Current local time as an "HH:MM" string for `<input type="time">`. */
export function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Parse "HH:MM" → minutes-of-day, or null. */
export function parseMinutes(t: unknown): number | null {
  if (typeof t !== 'string') return null;
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (Number.isNaN(h) || Number.isNaN(min)) return null;
  return h * 60 + min;
}

/** Duration of a single visit in minutes (handles past-midnight rollover). */
export function visitMinutes(timeIn: unknown, timeOut: unknown): number | null {
  const a = parseMinutes(timeIn);
  const b = parseMinutes(timeOut);
  if (a === null || b === null) return null;
  let diff = b - a;
  if (diff < 0) diff += 24 * 60;
  return diff;
}

/** Total minutes across visit log (completed cycles summed; handoffs stay one span). */
export function totalVisitMinutes(visits: any[] | undefined): number {
  if (!Array.isArray(visits)) return 0;
  return epeVisitsTotalMinutes(visits) ?? 0;
}

/** Format minutes as "1h 25m". */
export function fmtHM(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Fresh visit fields when logging a returning student (do not copy prior visit). */
export function emptyReturningVisitFields() {
  return {
    educationStatus: '',
    intakeActivity: [] as string[],
    placementClass: '',
    intakeSession: '',
    timeIn: nowHHMM(),
    timeOut: '',
    isLeaving: '',
    notes: '',
  };
}
