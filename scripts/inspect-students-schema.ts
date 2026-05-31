/**
 * Inspect students collection schema and updatedAt coverage.
 * Used for Power Platform sync planning (step 1).
 *
 * Usage: npx tsx scripts/inspect-students-schema.ts
 * Requires MONGODB_URI in .env or .env.local
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { MongoClient } from 'mongodb';

const DB_NAME = 'student-label';
const COLLECTION = 'students';

function loadMongoUri(): string {
  const root = resolve(__dirname, '..');
  for (const file of ['.env.local', '.env']) {
    const path = resolve(root, file);
    if (!existsSync(path)) continue;
    const content = readFileSync(path, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      if (key !== 'MONGODB_URI') continue;
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      return value;
    }
  }
  throw new Error('MONGODB_URI not found in .env or .env.local');
}

function mergeFieldTypes(
  acc: Map<string, Set<string>>,
  doc: Record<string, unknown>,
  prefix = ''
) {
  for (const [key, value] of Object.entries(doc)) {
    const field = prefix ? `${prefix}.${key}` : key;
    const type =
      value === null
        ? 'null'
        : Array.isArray(value)
          ? 'array'
          : value instanceof Date
            ? 'date'
            : typeof value;

    if (!acc.has(field)) acc.set(field, new Set());
    acc.get(field)!.add(type);

    if (type === 'object' && value !== null && !Array.isArray(value)) {
      mergeFieldTypes(acc, value as Record<string, unknown>, field);
    }
  }
}

async function main() {
  const uri = process.env.MONGODB_URI ?? loadMongoUri();
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const col = client.db(DB_NAME).collection(COLLECTION);

    const total = await col.countDocuments();
    const withUpdatedAt = await col.countDocuments({ updatedAt: { $exists: true, $ne: null } });
    const withoutUpdatedAt = total - withUpdatedAt;

    const sampleSize = Math.min(100, Math.max(total, 1));
    const sample = await col.aggregate([{ $sample: { size: sampleSize } }]).toArray();

    const fields = new Map<string, Set<string>>();
    for (const doc of sample) {
      mergeFieldTypes(fields, doc as Record<string, unknown>);
    }

    const sortedFields = [...fields.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, types]) => ({
        field: name,
        types: [...types].sort(),
        inSample: sample.filter((d) => {
          const parts = name.split('.');
          let cur: unknown = d;
          for (const p of parts) {
            if (cur == null || typeof cur !== 'object') return false;
            cur = (cur as Record<string, unknown>)[p];
          }
          return cur !== undefined;
        }).length,
      }));

    const latestUpdated = await col
      .find({ updatedAt: { $exists: true } })
      .sort({ updatedAt: -1 })
      .limit(1)
      .project({ updatedAt: 1, studentId: 1, labelId: 1 })
      .toArray();

    const latestCreated = await col
      .find({})
      .sort({ createdAt: -1 })
      .limit(1)
      .project({ createdAt: 1, updatedAt: 1, studentId: 1, labelId: 1 })
      .toArray();

    console.log(JSON.stringify({
      database: DB_NAME,
      collection: COLLECTION,
      counts: {
        total,
        withUpdatedAt,
        withoutUpdatedAt,
        updatedAtCoveragePct: total ? Math.round((withUpdatedAt / total) * 1000) / 10 : 0,
      },
      sampleSize: sample.length,
      fields: sortedFields,
      latestUpdated: latestUpdated[0] ?? null,
      latestCreated: latestCreated[0] ?? null,
      codeNotes: {
        insertSetsUpdatedAt: false,
        putSetsUpdatedAt: true,
        bulkUploadSetsUpdatedAt: true,
        archiveSetsUpdatedAt: true,
      },
    }, null, 2));
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
