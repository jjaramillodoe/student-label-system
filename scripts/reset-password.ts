import { existsSync, readFileSync } from 'fs';
import { MongoClient } from 'mongodb';
import * as bcrypt from 'bcrypt';
import readline from 'readline';
import { Writable } from 'stream';

const [, , email] = process.argv;

if (!email) {
  console.error('Usage: npm run reset-password -- <email>');
  process.exit(1);
}

function loadEnvFile(fileName: string) {
  if (!existsSync(fileName)) return;

  const lines = readFileSync(fileName, 'utf8').split(/\r?\n/);
  for (const line of lines) {
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
  console.error('MONGODB_URI not set in environment variables');
  process.exit(1);
}

function promptHidden(query: string): Promise<string> {
  let muted = false;
  const output = new Writable({
    write(chunk, encoding, callback) {
      if (!muted) {
        process.stdout.write(chunk, encoding);
      }
      callback();
    },
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output,
    terminal: true,
  });

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
    muted = true;
  });
}

async function main() {
  const password = await promptHidden(`New password for ${email}: `);
  if (!password.trim()) {
    console.error('Password cannot be empty');
    process.exit(1);
  }

  const confirmPassword = await promptHidden('Confirm new password: ');
  if (password !== confirmPassword) {
    console.error('Passwords do not match');
    process.exit(1);
  }

  const client = new MongoClient(uri as string);
  try {
    await client.connect();
    const db = client.db('student-label');
    const users = db.collection('users');
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await users.updateOne(
      { email },
      { $set: { password: hashedPassword, updatedAt: new Date().toISOString() } }
    );

    if (result.matchedCount === 0) {
      console.error(`No user found for ${email}`);
      process.exit(1);
    }

    console.log(`Password reset successfully for ${email}`);
  } catch (err) {
    console.error('Error resetting password:', err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
