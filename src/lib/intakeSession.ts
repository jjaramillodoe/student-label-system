import { parseMinutesOfDay } from '@/lib/epeClock';
import { escapeRegex } from '@/lib/studentSearch';

export type IntakeSession = {
  name: string;
  startTime: string;
  endTime: string;
};

export const EMPTY_INTAKE_SESSION: IntakeSession = {
  name: '',
  startTime: '08:00',
  endTime: '16:00',
};

/** Default sessions with time windows (replaces legacy name-only list). */
export const DEFAULT_INTAKE_SESSION_CONFIGS: IntakeSession[] = [
  { name: 'MORNING 8am-4pm', startTime: '08:00', endTime: '16:00' },
  { name: 'EVENING 4pm-5pm', startTime: '16:00', endTime: '17:00' },
  { name: 'SATURDAY', startTime: '08:00', endTime: '16:00' },
  { name: 'MS265', startTime: '08:00', endTime: '16:00' },
  { name: 'SSHS', startTime: '08:00', endTime: '16:00' },
  { name: 'BUSHWICK-EVENING', startTime: '16:00', endTime: '20:00' },
  { name: 'RIDGEWOOD', startTime: '08:00', endTime: '16:00' },
];

function normalizeTime(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallback;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return fallback;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function amPmTo24(hour: number, minute: number, meridiem: string): string {
  let h = hour % 12;
  if (meridiem.toLowerCase() === 'pm') h += 12;
  return `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function parseTimeRangeFromName(name: string): Pick<IntakeSession, 'startTime' | 'endTime'> | null {
  const match = name.match(
    /(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*-\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i,
  );
  if (!match) return null;
  const startMinute = match[2] ? parseInt(match[2], 10) : 0;
  const endMinute = match[5] ? parseInt(match[5], 10) : 0;
  return {
    startTime: amPmTo24(parseInt(match[1], 10), startMinute, match[3]),
    endTime: amPmTo24(parseInt(match[4], 10), endMinute, match[6]),
  };
}

export function legacyStringToSession(text: string): IntakeSession | null {
  const name = text.trim();
  if (!name) return null;

  const parsedRange = parseTimeRangeFromName(name);
  if (parsedRange) return { name, ...parsedRange };

  const known = DEFAULT_INTAKE_SESSION_CONFIGS.find(
    (session) => session.name.toLowerCase() === name.toLowerCase(),
  );
  if (known) return { ...known };

  return { name, startTime: '08:00', endTime: '16:00' };
}

export function normalizeIntakeSession(value: unknown): IntakeSession | null {
  if (typeof value === 'string') return legacyStringToSession(value);

  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const name = typeof record.name === 'string' ? record.name.trim() : '';
  if (!name) return null;

  const legacy = typeof value === 'string' ? null : legacyStringToSession(name);
  const fallbackStart = legacy?.startTime ?? '08:00';
  const fallbackEnd = legacy?.endTime ?? '16:00';

  return {
    name,
    startTime: normalizeTime(record.startTime, fallbackStart),
    endTime: normalizeTime(record.endTime, fallbackEnd),
  };
}

export function normalizeIntakeSessions(values: unknown): IntakeSession[] {
  if (!Array.isArray(values)) return [];
  const sessions: IntakeSession[] = [];
  for (const item of values) {
    const session = normalizeIntakeSession(item);
    if (session) sessions.push(session);
  }
  return sessions;
}

export function intakeSessionNames(sessions: IntakeSession[]): string[] {
  return sessions.map((session) => session.name);
}

export function formatTime12(time: string): string {
  const minutes = parseMinutesOfDay(time);
  if (minutes === null) return time;
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const meridiem = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${meridiem}`;
}

export function formatSessionTimeRange(session: IntakeSession): string {
  return `${formatTime12(session.startTime)} – ${formatTime12(session.endTime)}`;
}

export function findIntakeSession(
  sessions: IntakeSession[],
  name?: string | null,
): IntakeSession | undefined {
  if (!name) return undefined;
  const trimmed = name.trim();
  return sessions.find((session) => session.name === trimmed);
}

export function isTimeInSessionWindow(time: string, session: IntakeSession): boolean {
  const value = parseMinutesOfDay(time);
  const start = parseMinutesOfDay(session.startTime);
  const end = parseMinutesOfDay(session.endTime);
  if (value === null || start === null || end === null) return true;
  return value >= start && value <= end;
}

export function getIntakeSessionTimeFieldErrors(params: {
  intakeSession?: string | null;
  timeIn?: string | null;
  timeOut?: string | null;
  sessions: IntakeSession[];
}): { timeIn?: string; timeOut?: string } {
  const session = findIntakeSession(params.sessions, params.intakeSession);
  if (!session) return {};

  const errors: { timeIn?: string; timeOut?: string } = {};

  if (params.timeIn && !isTimeInSessionWindow(params.timeIn, session)) {
    errors.timeIn = `Time In must be within the ${session.name} window (${formatSessionTimeRange(session)}).`;
  }

  if (params.timeOut && !isTimeInSessionWindow(params.timeOut, session)) {
    errors.timeOut = `Time Out must be within the ${session.name} window (${formatSessionTimeRange(session)}).`;
  }

  return errors;
}

export function validateIntakeSessionTimes(params: {
  intakeSession?: string | null;
  timeIn?: string | null;
  timeOut?: string | null;
  sessions: IntakeSession[];
}): string | null {
  const errors = getIntakeSessionTimeFieldErrors(params);
  return errors.timeIn ?? errors.timeOut ?? null;
}

export async function getSchoolIntakeSessions(
  db: { collection: (name: string) => { findOne: (query: object) => Promise<{ intakeSessions?: unknown } | null> } },
  schoolName?: string | null,
): Promise<IntakeSession[]> {
  if (!schoolName?.trim()) return DEFAULT_INTAKE_SESSION_CONFIGS;

  const schoolDoc = await db.collection('school_config').findOne({
    name: {
      $regex: `^${escapeRegex(schoolName.trim())}$`,
      $options: 'i',
    },
  });

  const configured = normalizeIntakeSessions(schoolDoc?.intakeSessions);
  return configured.length ? configured : DEFAULT_INTAKE_SESSION_CONFIGS;
}
