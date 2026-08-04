/**
 * Wipe operational MongoDB data while keeping config and accounts.
 *
 * PRESERVED (never touched):
 *   - app_settings
 *   - school_config
 *   - school_legacy_roster
 *   - users
 *
 * WIPED (deleteMany on every other collection in the DB), including:
 *   audit_logs, cabinet_archives, cabinet_move_events, cabinets,
 *   email_validation_jobs, email_validation_usage, label_stock,
 *   label_stock_events, print_history, students, sync_export_log, …
 *   plus any leftover hyphenated names (print-history, audit-logs).
 *
 * Usage:
 *   npx tsx scripts/wipe-operational-data.ts            # dry-run
 *   npx tsx scripts/wipe-operational-data.ts --confirm  # actually wipe
 *
 * Requires MONGODB_URI in .env / .env.local
 */
import { existsSync, readFileSync } from 'fs';
import { MongoClient } from 'mongodb';

const PRESERVE = new Set([
  'app_settings',
  'school_config',
  'school_legacy_roster',
  'users',
]);

/** Known operational collections — wiped if present. Others (except PRESERVE) are also wiped. */
const KNOWN_WIPE = [
  'audit_logs',
  'audit-logs',
  'cabinet_archives',
  'cabinet_move_events',
  'cabinets',
  'email_validation_jobs',
  'email_validation_usage',
  'label_stock',
  'label_stock_events',
  'print_history',
  'print-history',
  'students',
  'sync_export_log',
];

function loadEnvFile(fileName: string) {
  if (!existsSync(fileName)) return;
  for (const line of readFileSync(fileName, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (!match) continue;
    const [, key, rawValue = ''] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
  }
}

loadEnvFile('.env.local');
loadEnvFile('.env');

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI not set. Add it to .env or .env.local.');
  process.exit(1);
}

const confirm = process.argv.includes('--confirm');
const dropEmpty = process.argv.includes('--drop-empty');

async function main() {
  const client = new MongoClient(uri!);
  await client.connect();

  // Match app default db name from mongodb URI path, else student-label
  const dbNameFromUri = (() => {
    try {
      const path = new URL(uri!).pathname.replace(/^\//, '');
      return path.split('/')[0] || 'student-label';
    } catch {
      return 'student-label';
    }
  })();
  const db = client.db(dbNameFromUri);

  console.log(`Database: ${db.databaseName}`);
  console.log(`Mode: ${confirm ? 'CONFIRM — will delete documents' : 'DRY-RUN — no changes'}`);
  console.log(`Preserve: ${[...PRESERVE].join(', ')}`);
  console.log('');

  const existing = await db.listCollections().toArray();
  const names = existing.map((c) => c.name).sort();

  const toWipe = names.filter((n) => !PRESERVE.has(n));
  const preserved = names.filter((n) => PRESERVE.has(n));
  const missingKnown = KNOWN_WIPE.filter((n) => !names.includes(n) && !PRESERVE.has(n));

  console.log('Collections present (preserved):');
  for (const name of preserved) {
    const count = await db.collection(name).estimatedDocumentCount();
    console.log(`  keep  ${name.padEnd(28)} ~${count} docs`);
  }

  console.log('\nCollections to wipe:');
  const plan: Array<{ name: string; count: number }> = [];
  for (const name of toWipe) {
    const count = await db.collection(name).estimatedDocumentCount();
    plan.push({ name, count });
    console.log(`  wipe  ${name.padEnd(28)} ~${count} docs`);
  }

  if (missingKnown.length) {
    console.log('\nKnown wipe targets not present (ok):');
    for (const name of missingKnown) console.log(`  skip  ${name}`);
  }

  if (!confirm) {
    console.log('\nDry-run only. Re-run with --confirm to delete documents:');
    console.log('  npx tsx scripts/wipe-operational-data.ts --confirm');
    await client.close();
    return;
  }

  console.log('\nWiping…');
  let totalDeleted = 0;
  for (const { name } of plan) {
    const result = await db.collection(name).deleteMany({});
    totalDeleted += result.deletedCount;
    console.log(`  deleted ${result.deletedCount} from ${name}`);
    if (dropEmpty) {
      await db.collection(name).drop().catch(() => undefined);
      console.log(`  dropped collection ${name}`);
    }
  }

  console.log(`\nDone. Deleted ${totalDeleted} documents across ${plan.length} collections.`);
  console.log('Preserved app_settings, school_config, school_legacy_roster, users.');
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
