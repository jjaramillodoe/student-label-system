import type { Db, IndexDirection, IndexSpecification } from 'mongodb';

export type StudentIndexSpec = {
  name: string;
  keys: IndexSpecification;
  options: {
    name: string;
    unique?: boolean;
    sparse?: boolean;
  };
};

/** Indexes required for school-scoped lists, ID lookup, and sync cursors. */
export const STUDENT_INDEX_SPECS: StudentIndexSpec[] = [
  {
    name: 'school_archived',
    keys: { school: 1, archived: 1 } as Record<string, IndexDirection>,
    options: { name: 'school_archived' },
  },
  {
    name: 'sync_updatedAt_id',
    keys: { updatedAt: 1, _id: 1 } as Record<string, IndexDirection>,
    options: { name: 'sync_updatedAt_id' },
  },
  {
    name: 'sync_createdAt_id',
    keys: { createdAt: 1, _id: 1 } as Record<string, IndexDirection>,
    options: { name: 'sync_createdAt_id' },
  },
  {
    name: 'sync_studentId',
    keys: { studentId: 1 } as Record<string, IndexDirection>,
    options: { name: 'sync_studentId', unique: true, sparse: true },
  },
  {
    name: 'sync_labelId',
    keys: { labelId: 1 } as Record<string, IndexDirection>,
    options: { name: 'sync_labelId', sparse: true },
  },
  {
    name: 'labelId_unique_sparse',
    keys: { labelId: 1 } as Record<string, IndexDirection>,
    options: { name: 'labelId_unique_sparse', unique: true, sparse: true },
  },
];

export type EnsureIndexesResult = {
  created: string[];
  skipped: Array<{ name: string; reason: string }>;
};

/**
 * Idempotent createIndex. Unique indexes that collide with duplicate data are
 * skipped and reported instead of failing the process.
 */
export async function ensureStudentIndexes(db: Db): Promise<EnsureIndexesResult> {
  const col = db.collection('students');
  const created: string[] = [];
  const skipped: Array<{ name: string; reason: string }> = [];

  for (const spec of STUDENT_INDEX_SPECS) {
    try {
      const result = await col.createIndex(spec.keys, spec.options);
      created.push(typeof result === 'string' ? result : spec.name);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      skipped.push({ name: spec.name, reason });
    }
  }

  return { created, skipped };
}
