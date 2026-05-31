import { existsSync, readFileSync } from 'fs';
import { MongoClient } from 'mongodb';
import * as bcrypt from 'bcrypt';

// Usage: npm run add-user -- email name role school password
const [,, email, name, role, school, password] = process.argv;

if (!email || !name || !role || !school || !password) {
  console.error('Usage: npm run add-user -- <email> <name> <role> <school> <password>');
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

async function main() {
  const client = new MongoClient(uri as string);
  try {
    await client.connect();
    const db = client.db('student-label');
    const users = db.collection('users');
    const existing = await users.findOne({ email });
    if (existing) {
      console.error('User with this email already exists.');
      process.exit(1);
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await users.insertOne({
      email,
      name,
      role,
      school,
      password: hashedPassword,
    });
    console.log('User added successfully:', result.insertedId);
  } catch (err) {
    console.error('Error adding user:', err);
  } finally {
    await client.close();
  }
}

main(); 