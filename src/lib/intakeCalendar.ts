/** School-local calendar for intake visits (NYC Adult Ed). */
export const SCHOOL_INTAKE_TZ = 'America/New_York';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatPartsDate(
  parts: Intl.DateTimeFormatPart[],
): string | null {
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  if (!year || !month || !day) return null;
  return `${year}-${month}-${day}`;
}

export function visitDayKey(
  date?: string,
  timeZone: string = SCHOOL_INTAKE_TZ,
): string | null {
  if (!date) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  return formatPartsDate(parts);
}

export function todayDayKey(
  now: Date = new Date(),
  timeZone: string = SCHOOL_INTAKE_TZ,
): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  return formatPartsDate(parts) ?? '';
}

/** Minutes from midnight in the school timezone. */
export function nowMinutesOfDay(
  now: Date = new Date(),
  timeZone: string = SCHOOL_INTAKE_TZ,
): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
  return hour * 60 + minute;
}

export function formatDayLabel(dayKey: string): string {
  const d = new Date(`${dayKey}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dayKey;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatMinutesOfDay(minutes: number): string {
  const normalized = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${pad2(h)}:${pad2(m)}`;
}
