import { parseMinutesOfDay } from '@/lib/epeClock';
import { todayDayKey, visitDayKey } from '@/lib/intakeCalendar';
import { isClockedOut, type IntakeVisitLike } from '@/lib/intakeVisitValidation';

export type EnrollmentInsightDoc = {
  createdAt?: unknown;
  educationStatus?: string;
  intakeSession?: string;
  timeIn?: unknown;
  timeOut?: unknown | null;
  isLeaving?: string;
  intakeVisits?: IntakeVisitLike[];
};

export type SessionMixPoint = { name: string; count: number };
export type HourMixPoint = { hour: number; label: string; count: number };
export type DailyMixPoint = { date: string; newFiles: number; visits: number };

export interface EnrollmentInsights {
  newFiles: number;
  visits: number;
  returningVisits: number;
  clockedOutVisits: number;
  openVisits: number;
  clockOutRate: number | null;
  beStudents: number;
  eslStudents: number;
  sessionMix: SessionMixPoint[];
  hourMix: HourMixPoint[];
  daily: DailyMixPoint[];
}

function toTime(value: unknown): number | null {
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isNaN(t) ? null : t;
  }
  if (typeof value === 'string' && value.trim()) {
    const t = new Date(value).getTime();
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

function inPeriod(value: unknown, start: Date | null): boolean {
  if (!start) return true;
  const t = toTime(value);
  return t !== null && t >= start.getTime();
}

function dateKey(value: unknown): string | null {
  if (value instanceof Date) return visitDayKey(value.toISOString());
  if (typeof value === 'string') return visitDayKey(value);
  return null;
}

function collectVisits(doc: EnrollmentInsightDoc): IntakeVisitLike[] {
  if (Array.isArray(doc.intakeVisits) && doc.intakeVisits.length) {
    return doc.intakeVisits;
  }
  if (doc.timeIn) {
    return [{
      date: typeof doc.createdAt === 'string' ? doc.createdAt : undefined,
      timeIn: typeof doc.timeIn === 'string' ? doc.timeIn : undefined,
      timeOut: typeof doc.timeOut === 'string' ? doc.timeOut : null,
      isLeaving: doc.isLeaving,
      intakeSession: doc.intakeSession,
      educationStatus: doc.educationStatus,
    }];
  }
  return [];
}

function programBucket(status?: string): 'BE' | 'ESL' | null {
  const s = (status || '').toUpperCase();
  if (!s.trim()) return null;
  if (s.includes('ESL')) return 'ESL';
  if (/\bBE\b/.test(s) || s.includes('BASIC')) return 'BE';
  return null;
}

function hourLabel(hour: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12} ${period}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function eachDayKey(fromDay: string, toDay: string): string[] {
  if (!fromDay || !toDay || fromDay > toDay) return [];
  const out: string[] = [];
  let [year, month, day] = fromDay.split('-').map(Number);
  while (out.length < 400) {
    const key = `${year}-${pad2(month)}-${pad2(day)}`;
    out.push(key);
    if (key >= toDay) break;
    const next = new Date(Date.UTC(year, month - 1, day + 1));
    year = next.getUTCFullYear();
    month = next.getUTCMonth() + 1;
    day = next.getUTCDate();
  }
  return out;
}

export function shortSessionLabel(name: string): string {
  const trimmed = name.trim() || 'Unspecified';
  const cut = trimmed.split(/[–—-]/)[0]?.trim() || trimmed;
  return cut.length > 22 ? `${cut.slice(0, 20)}…` : cut;
}

export function buildEnrollmentInsights(
  docs: EnrollmentInsightDoc[],
  options: { periodStart: Date | null; trendStart: Date; now?: Date },
): EnrollmentInsights {
  const now = options.now ?? new Date();
  const start = options.periodStart;
  const hourCounts = new Array(24).fill(0) as number[];
  const sessionCounts = new Map<string, number>();
  const dailyMap = new Map<string, { newFiles: number; visits: number }>();

  const bump = (day: string | null) => {
    if (!day) return null;
    if (!dailyMap.has(day)) dailyMap.set(day, { newFiles: 0, visits: 0 });
    return dailyMap.get(day)!;
  };

  let newFiles = 0;
  let visits = 0;
  let returningVisits = 0;
  let clockedOutVisits = 0;
  let openVisits = 0;
  let beStudents = 0;
  let eslStudents = 0;

  for (const doc of docs) {
    if (inPeriod(doc.createdAt, start)) {
      newFiles += 1;
      const createdDay = dateKey(doc.createdAt);
      const row = bump(createdDay);
      if (row) row.newFiles += 1;
    }

    const list = collectVisits(doc);
    let latestProgram: string | undefined;
    let hadVisitInPeriod = false;
    list.forEach((visit, index) => {
      const when = visit.date ?? doc.createdAt;
      if (!inPeriod(when, start)) return;
      hadVisitInPeriod = true;
      visits += 1;
      if (index > 0) returningVisits += 1;
      if (isClockedOut(visit)) clockedOutVisits += 1;
      else openVisits += 1;

      const session = (visit.intakeSession || doc.intakeSession || 'Unspecified').trim() || 'Unspecified';
      sessionCounts.set(session, (sessionCounts.get(session) || 0) + 1);

      const mins = parseMinutesOfDay(visit.timeIn);
      if (mins !== null) hourCounts[Math.floor(mins / 60)] += 1;

      const visitDay = dateKey(when);
      const row = bump(visitDay);
      if (row) row.visits += 1;

      if (visit.educationStatus) latestProgram = visit.educationStatus;
    });

    if (hadVisitInPeriod) {
      const bucket = programBucket(latestProgram || doc.educationStatus);
      if (bucket === 'BE') beStudents += 1;
      else if (bucket === 'ESL') eslStudents += 1;
    }
  }

  const fromDay = todayDayKey(options.trendStart);
  const toDay = todayDayKey(now);
  const daily = eachDayKey(fromDay, toDay).map((date) => {
    const row = dailyMap.get(date);
    return { date, newFiles: row?.newFiles ?? 0, visits: row?.visits ?? 0 };
  });

  const sessionMix = [...sessionCounts.entries()]
    .map(([name, count]) => ({ name: shortSessionLabel(name), count }))
    .sort((a, b) => b.count - a.count);

  const hourMix = hourCounts
    .map((count, hour) => ({ hour, label: hourLabel(hour), count }))
    .filter((row) => row.count > 0);

  return {
    newFiles,
    visits,
    returningVisits,
    clockedOutVisits,
    openVisits,
    clockOutRate: visits > 0 ? Math.round((clockedOutVisits / visits) * 100) : null,
    beStudents,
    eslStudents,
    sessionMix,
    hourMix,
    daily,
  };
}
