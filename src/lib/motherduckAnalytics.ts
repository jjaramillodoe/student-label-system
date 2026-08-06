import { ensureMotherDuckSchema, motherduckQuery } from '@/lib/motherduck';

export type MotherDuckAnalyticsPayload = {
  source: 'motherduck';
  timestamp: string;
  lastSyncedAt: string | null;
  students: {
    total: number;
    active: number;
    archived: number;
    bySchool: Array<{ school: string; count: number }>;
    byStatus: Array<{ status: string; count: number }>;
  };
  enrollment: {
    today: number;
    week: number;
    month: number;
    trend: Array<{ date: string; label: string; count: number }>;
  };
};

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildEmptyTrend(days: number) {
  const out: Array<{ date: string; label: string; count: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - i);
    out.push({
      date: dayKey(d),
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      count: 0,
    });
  }
  return out;
}

export async function queryMotherDuckAnalytics(): Promise<MotherDuckAnalyticsPayload> {
  await ensureMotherDuckSchema();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const week = new Date(today);
  const day = week.getDay();
  week.setDate(week.getDate() - (day === 0 ? 6 : day - 1));
  const month = new Date(today.getFullYear(), today.getMonth(), 1);
  const trendStart = new Date(today);
  trendStart.setDate(trendStart.getDate() - 13);

  const todayIso = today.toISOString();
  const weekIso = week.toISOString();
  const monthIso = month.toISOString();
  const trendStartKey = dayKey(trendStart);

  const [
    totals,
    bySchool,
    byStatus,
    enrollToday,
    enrollWeek,
    enrollMonth,
    trendRows,
    syncMeta,
  ] = await Promise.all([
    motherduckQuery<{ total: number; active: number; archived: number }>(`
      SELECT
        COUNT(*)::INTEGER AS total,
        COUNT(*) FILTER (WHERE archived = false)::INTEGER AS active,
        COUNT(*) FILTER (WHERE archived = true)::INTEGER AS archived
      FROM students
    `),
    motherduckQuery<{ school: string; count: number }>(`
      SELECT COALESCE(school, '(none)') AS school, COUNT(*)::INTEGER AS count
      FROM students
      GROUP BY 1
      ORDER BY count DESC
      LIMIT 12
    `),
    motherduckQuery<{ status: string; count: number }>(`
      SELECT
        CASE WHEN archived THEN 'Archived' ELSE COALESCE(status, 'Active') END AS status,
        COUNT(*)::INTEGER AS count
      FROM students
      GROUP BY 1
      ORDER BY count DESC
    `),
    motherduckQuery<{ count: number }>(
      `SELECT COUNT(*)::INTEGER AS count FROM students WHERE created_at >= $1`,
      [todayIso],
    ),
    motherduckQuery<{ count: number }>(
      `SELECT COUNT(*)::INTEGER AS count FROM students WHERE created_at >= $1`,
      [weekIso],
    ),
    motherduckQuery<{ count: number }>(
      `SELECT COUNT(*)::INTEGER AS count FROM students WHERE created_at >= $1`,
      [monthIso],
    ),
    motherduckQuery<{ date: string; count: number }>(
      `
      SELECT substr(created_at, 1, 10) AS date, COUNT(*)::INTEGER AS count
      FROM students
      WHERE created_at IS NOT NULL AND substr(created_at, 1, 10) >= $1
      GROUP BY 1
      ORDER BY 1
      `,
      [trendStartKey],
    ),
    motherduckQuery<{ value: string }>(
      `SELECT value FROM sync_meta WHERE key = 'students_last_synced_at' LIMIT 1`,
    ),
  ]);

  const emptyTrend = buildEmptyTrend(14);
  const trendMap = new Map(trendRows.map((r) => [r.date, Number(r.count)]));
  const trend = emptyTrend.map((row) => ({
    ...row,
    count: trendMap.get(row.date) || 0,
  }));

  const t = totals[0] || { total: 0, active: 0, archived: 0 };

  return {
    source: 'motherduck',
    timestamp: new Date().toISOString(),
    lastSyncedAt: syncMeta[0]?.value || null,
    students: {
      total: Number(t.total) || 0,
      active: Number(t.active) || 0,
      archived: Number(t.archived) || 0,
      bySchool: bySchool.map((r) => ({ school: r.school, count: Number(r.count) })),
      byStatus: byStatus.map((r) => ({ status: r.status, count: Number(r.count) })),
    },
    enrollment: {
      today: Number(enrollToday[0]?.count) || 0,
      week: Number(enrollWeek[0]?.count) || 0,
      month: Number(enrollMonth[0]?.count) || 0,
      trend,
    },
  };
}
