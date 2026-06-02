import clientPromise from '@/lib/mongodb';

export type SyncExportLogEntry = {
  exportedAt: string;
  since: string;
  recordCount: number;
  hasMore: boolean;
};

const COLLECTION = 'sync_export_log';

export async function logSyncExport(entry: Omit<SyncExportLogEntry, 'exportedAt'>): Promise<void> {
  try {
    const client = await clientPromise;
    const db = client.db('student-label');
    await db.collection(COLLECTION).insertOne({
      ...entry,
      exportedAt: new Date().toISOString(),
    });
    // Keep collection small — trim entries older than 90 days asynchronously
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    await db.collection(COLLECTION).deleteMany({ exportedAt: { $lt: cutoff } });
  } catch (error) {
    console.error('Failed to log sync export:', error);
  }
}

export async function getLastSyncExport(): Promise<SyncExportLogEntry | null> {
  try {
    const client = await clientPromise;
    const db = client.db('student-label');
    const doc = await db.collection(COLLECTION).findOne(
      {},
      { sort: { exportedAt: -1 }, projection: { _id: 0, exportedAt: 1, since: 1, recordCount: 1, hasMore: 1 } },
    );
    if (!doc?.exportedAt) return null;
    return {
      exportedAt: String(doc.exportedAt),
      since: String(doc.since ?? ''),
      recordCount: Number(doc.recordCount ?? 0),
      hasMore: Boolean(doc.hasMore),
    };
  } catch {
    return null;
  }
}
