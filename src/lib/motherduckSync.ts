import clientPromise from '@/lib/mongodb';
import {
  ensureMotherDuckSchema,
  getMotherDuckDatabase,
  withMotherDuckClient,
} from '@/lib/motherduck';
import { normalizeMongoId } from '@/lib/utils';

export type MotherDuckStudentRow = {
  source_mongo_id: string;
  student_id: string | null;
  label_id: string | null;
  first_name: string | null;
  last_name: string | null;
  dob: string | null;
  email: string | null;
  phone: string | null;
  school: string | null;
  fiscal_year: string | null;
  status: string | null;
  archived: boolean;
  start_date: string | null;
  end_date: string | null;
  cabinet: string | null;
  drawer: string | null;
  drawer_section: string | null;
  program: string | null;
  intake_student_status: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v : null;
}

export function studentDocToMotherDuckRow(doc: Record<string, unknown>): MotherDuckStudentRow {
  const id = normalizeMongoId(doc._id) ?? String(doc._id ?? '');
  return {
    source_mongo_id: id,
    student_id: str(doc.studentId),
    label_id: str(doc.labelId),
    first_name: str(doc.firstName),
    last_name: str(doc.lastName),
    dob: str(doc.dob),
    email: str(doc.email),
    phone: str(doc.phone),
    school: str(doc.school),
    fiscal_year: str(doc.fiscalYear),
    status: str(doc.status) || (doc.archived === true ? 'Archived' : 'Active'),
    archived: doc.archived === true,
    start_date: str(doc.startDate),
    end_date: str(doc.endDate),
    cabinet: str(doc.cabinet),
    drawer: str(doc.drawer),
    drawer_section: str(doc.drawerSection),
    program: str(doc.program),
    intake_student_status: str(doc.intakeStudentStatus),
    created_at: str(doc.createdAt),
    updated_at: str(doc.updatedAt) || str(doc.createdAt),
  };
}

const UPSERT_SQL = `
  INSERT OR REPLACE INTO students (
    source_mongo_id, student_id, label_id, first_name, last_name, dob,
    email, phone, school, fiscal_year, status, archived,
    start_date, end_date, cabinet, drawer, drawer_section,
    program, intake_student_status, created_at, updated_at, synced_at
  ) VALUES (
    $1, $2, $3, $4, $5, $6,
    $7, $8, $9, $10, $11, $12,
    $13, $14, $15, $16, $17,
    $18, $19, $20, $21, CURRENT_TIMESTAMP
  )
`;

function rowParams(row: MotherDuckStudentRow): unknown[] {
  return [
    row.source_mongo_id,
    row.student_id,
    row.label_id,
    row.first_name,
    row.last_name,
    row.dob,
    row.email,
    row.phone,
    row.school,
    row.fiscal_year,
    row.status,
    row.archived,
    row.start_date,
    row.end_date,
    row.cabinet,
    row.drawer,
    row.drawer_section,
    row.program,
    row.intake_student_status,
    row.created_at,
    row.updated_at,
  ];
}

export type MotherDuckSyncResult = {
  synced: number;
  durationMs: number;
  database: string;
  lastSyncedAt: string;
};

/** Full refresh of MotherDuck students from MongoDB. */
export async function syncStudentsToMotherDuck(options?: {
  batchSize?: number;
}): Promise<MotherDuckSyncResult> {
  const batchSize = options?.batchSize ?? 100;
  const started = Date.now();

  await ensureMotherDuckSchema();

  const client = await clientPromise;
  const db = client.db('student-label');
  const cursor = db.collection('students').find({}).batchSize(batchSize);

  let synced = 0;

  await withMotherDuckClient(async (md) => {
    // Replace snapshot so deletes in Mongo are reflected
    await md.query('DELETE FROM students');

    let batch: MotherDuckStudentRow[] = [];

    const flush = async () => {
      if (batch.length === 0) return;
      for (const row of batch) {
        await md.query(UPSERT_SQL, rowParams(row));
      }
      synced += batch.length;
      batch = [];
    };

    for await (const doc of cursor) {
      batch.push(studentDocToMotherDuckRow(doc as Record<string, unknown>));
      if (batch.length >= batchSize) await flush();
    }
    await flush();

    const lastSyncedAt = new Date().toISOString();
    await md.query(
      `INSERT OR REPLACE INTO sync_meta (key, value, updated_at)
       VALUES ('students_last_synced_at', $1, CURRENT_TIMESTAMP)`,
      [lastSyncedAt],
    );
  });

  return {
    synced,
    durationMs: Date.now() - started,
    database: getMotherDuckDatabase(),
    lastSyncedAt: new Date().toISOString(),
  };
}
