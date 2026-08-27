/**
 * Student collection indexes and updatedAt backfill.
 *
 * Creates `{ school, archived }`, sync cursors, and unique sparse `studentId` /
 * `labelId` indexes (duplicate unique keys are skipped and reported).
 *
 * Usage:
 *   npx tsx scripts/setup-students-sync.ts
 *   npx tsx scripts/setup-students-sync.ts --dry-run
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { MongoClient } from 'mongodb';
import { STUDENT_INDEX_SPECS, ensureStudentIndexes } from '../src/lib/studentIndexes';

const DB_NAME = 'student-label';
const COLLECTION = 'students';
const dryRun = process.argv.includes('--dry-run');

function loadMongoUri(): string {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;

  const root = resolve(__dirname, '..');
  for (const file of ['.env.local', '.env']) {
    const path = resolve(root, file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split('\n')) {
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

  throw new Error('MONGODB_URI not found');
}

const INDEX_SPECS = STUDENT_INDEX_SPECS;

async function main() {
  const client = new MongoClient(loadMongoUri());

  try {
    await client.connect();
    const col = client.db(DB_NAME).collection(COLLECTION);

    const beforeMissing = await col.countDocuments({
      $or: [{ updatedAt: { $exists: false } }, { updatedAt: null }],
    });

    console.log(JSON.stringify({ phase: 'before', missingUpdatedAt: beforeMissing }, null, 2));

    if (dryRun) {
      console.log('Dry run — no writes performed.');
      console.log('Would create indexes:', INDEX_SPECS.map((spec) => spec.name));
      console.log(`Would backfill updatedAt on ${beforeMissing} documents.`);
      return;
    }

    const indexResult = await ensureStudentIndexes(client.db(DB_NAME));
    console.log('Indexes:', indexResult);

    const backfillResult = await col.updateMany(
      {
        $or: [{ updatedAt: { $exists: false } }, { updatedAt: null }],
        createdAt: { $exists: true, $ne: null },
      },
      [{ $set: { updatedAt: '$createdAt' } }]
    );

    const afterMissing = await col.countDocuments({
      $or: [{ updatedAt: { $exists: false } }, { updatedAt: null }],
    });

    console.log(
      JSON.stringify(
        {
          phase: 'after',
          indexes: indexResult,
          backfill: {
            matched: backfillResult.matchedCount,
            modified: backfillResult.modifiedCount,
          },
          missingUpdatedAt: afterMissing,
        },
        null,
        2
      )
    );
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
