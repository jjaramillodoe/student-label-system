import clientPromise from '@/lib/mongodb';
import {
  checkMongoDb,
  checkMotherDuckEnv,
  checkSyncApiEnv,
  checkThoughtSpotEnv,
} from '@/lib/healthChecks';
import { DEFAULT_INTAKE_ACTIVITIES, DEFAULT_INTAKE_SESSIONS } from '@/lib/intakeDefaults';
import { getCurrentFiscalYear } from '@/lib/fiscalYear';
import { getLastSyncExport } from '@/lib/syncExportLog';
import type { CollectionSizeEntry, IntegrationStatus, SystemStats } from '@/lib/systemStats.types';

export type { IntegrationStatus, SystemStats } from '@/lib/systemStats.types';

const DB_NAME = 'student-label';

const TRACKED_COLLECTIONS = [
  'students',
  'cabinets',
  'users',
  'audit_logs',
  'print_history',
  'school_config',
] as const;

function envConfigured(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

async function getCollectionSizes(db: {
  listCollections: () => { toArray: () => Promise<{ name: string }[]> };
  command: (cmd: object) => Promise<{ count?: number; storageSize?: number; size?: number }>;
}): Promise<CollectionSizeEntry[]> {
  const names = (await db.listCollections().toArray())
    .map((c) => c.name)
    .filter((name) => !name.startsWith('system.'));

  const sizes = await Promise.all(
    names.map(async (name) => {
      try {
        const stats = await db.command({ collStats: name, scale: 1 });
        return {
          name,
          count: stats.count ?? 0,
          storageSizeBytes: stats.storageSize ?? stats.size ?? 0,
        };
      } catch {
        return { name, count: 0, storageSizeBytes: 0 };
      }
    }),
  );

  return sizes.sort((a, b) => b.storageSizeBytes - a.storageSizeBytes);
}

function getOperationalInfo() {
  return {
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
    vercelUrl: process.env.VERCEL_URL,
    gitCommit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7),
    gitBranch: process.env.VERCEL_GIT_COMMIT_REF,
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID,
  };
}

export async function getSystemStats(): Promise<SystemStats> {
  const mongoCheck = await checkMongoDb();
  const client = await clientPromise;
  const db = client.db(DB_NAME);

  const [
    dbStats,
    collectionCounts,
    collectionSizes,
    totalStudents,
    activeStudents,
    archivedStudents,
    missingUpdatedAt,
    unmigratedStudentIds,
    missingCabinet,
    totalCabinets,
    cabinets,
    auditLogsLast7Days,
    printsLast30Days,
    studentsBySchool,
    lastSyncExport,
    appSettingsDoc,
  ] = await Promise.all([
    db.command({ dbStats: 1, scale: 1 }) as Promise<{
      dataSize?: number;
      storageSize?: number;
      indexSize?: number;
    }>,
    Promise.all(
      TRACKED_COLLECTIONS.map(async (name) => {
        const count = await db.collection(name).estimatedDocumentCount();
        return [name, count] as const;
      }),
    ),
    getCollectionSizes(db),
    db.collection('students').countDocuments(),
    db.collection('students').countDocuments({ archived: { $ne: true } }),
    db.collection('students').countDocuments({ archived: true }),
    db.collection('students').countDocuments({ updatedAt: { $exists: false } }),
    db.collection('students').countDocuments({ labelId: { $exists: false } }),
    db.collection('students').countDocuments({
      archived: { $ne: true },
      $or: [{ cabinet: { $exists: false } }, { cabinet: null }, { cabinet: '' }],
    }),
    db.collection('cabinets').estimatedDocumentCount(),
    db.collection('cabinets').find({}).toArray(),
    db.collection('audit_logs').countDocuments({
      time: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() },
    }),
    db.collection('print_history').countDocuments({
      time: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() },
    }),
    db
      .collection('students')
      .aggregate<{ _id: string; count: number }>([
        { $group: { _id: { $ifNull: ['$school', '(none)'] }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 15 },
      ])
      .toArray(),
    getLastSyncExport(),
    db.collection('app_settings').findOne({ key: 'global' }),
  ]);

  const totalCapacity = cabinets.reduce((sum, c) => sum + (c.totalCapacity || 0), 0);
  const totalUsed = cabinets.reduce((sum, c) => sum + (c.currentCount || 0), 0);
  const utilizationPercent =
    totalCapacity > 0 ? Math.round((totalUsed / totalCapacity) * 100) : 0;

  const withUpdatedAt = totalStudents - missingUpdatedAt;
  const syncReadyPercent =
    totalStudents > 0 ? Math.round((withUpdatedAt / totalStudents) * 1000) / 10 : 100;

  const syncApi = checkSyncApiEnv();
  const thoughtspot = checkThoughtSpotEnv();
  const motherduck = checkMotherDuckEnv();

  const devToolKeys = [
    'showSeedTestData',
    'showSeedCabinets',
    'showClearAllData',
    'showMigrateDrawers',
  ] as const;
  const devToolsVisible = devToolKeys.filter((key) => appSettingsDoc?.[key] === true).length;

  const integrations: IntegrationStatus[] = [
    {
      id: 'mongodb',
      label: 'MongoDB',
      configured: mongoCheck.ok,
      note: mongoCheck.ok ? 'Connected' : 'Disconnected',
    },
    {
      id: 'sync-api',
      label: 'Sync API key',
      configured: syncApi.ok,
      note: syncApi.ok ? 'Configured' : 'Not configured',
    },
    {
      id: 'thoughtspot',
      label: 'ThoughtSpot',
      configured: thoughtspot.ok,
      note: thoughtspot.ok ? 'Configured' : 'Not configured',
    },
    {
      id: 'motherduck',
      label: 'MotherDuck',
      configured: motherduck.ok,
      note: motherduck.ok ? 'Configured' : 'Not configured',
    },
    {
      id: 'email-validation',
      label: 'Email validation API',
      configured: envConfigured('EMAIL_VALIDATION_API_KEY'),
      note: envConfigured('EMAIL_VALIDATION_API_KEY') ? 'Configured' : 'Not configured',
    },
  ];

  return {
    timestamp: new Date().toISOString(),
    operational: getOperationalInfo(),
    database: {
      connected: mongoCheck.ok,
      latencyMs: mongoCheck.latencyMs,
      dataSizeBytes: dbStats.dataSize ?? 0,
      storageSizeBytes: dbStats.storageSize ?? 0,
      indexSizeBytes: dbStats.indexSize ?? 0,
      collections: Object.fromEntries(collectionCounts),
      collectionSizes,
    },
    students: {
      total: totalStudents,
      active: activeStudents,
      archived: archivedStudents,
      missingUpdatedAt,
      unmigratedStudentIds,
      missingCabinet,
      syncReadyPercent,
      bySchool: studentsBySchool.map((row) => ({
        school: row._id || '(none)',
        count: row.count,
      })),
    },
    cabinets: {
      total: totalCabinets,
      totalCapacity,
      totalUsed,
      utilizationPercent,
    },
    activity: {
      auditLogsLast7Days,
      printsLast30Days,
    },
    sync: {
      apiConfigured: syncApi.ok,
      lastExport: lastSyncExport,
    },
    appDefaults: {
      currentFiscalYear: getCurrentFiscalYear(),
      defaultIntakeSessionCount: DEFAULT_INTAKE_SESSIONS.length,
      defaultIntakeActivityCount: DEFAULT_INTAKE_ACTIVITIES.length,
      devToolsVisible,
    },
    integrations,
  };
}
