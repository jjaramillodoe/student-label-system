import { MongoClient, ObjectId } from 'mongodb';
import readline from 'readline';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'student-label';

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans); }));
}

async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);

  const cabinets = await db.collection('cabinets').find({}).toArray();
  if (cabinets.length === 0) {
    console.error('No cabinets found!');
    process.exit(1);
  }
  console.log('Available cabinets:');
  cabinets.forEach((cab, i) => {
    console.log(`${i + 1}: ${cab.name}${cab.identifier ? ' (' + cab.identifier + ')' : ''} - _id: ${cab._id}`);
  });
  const cabIdx = parseInt(await prompt('Select default cabinet by number: '), 10) - 1;
  const cabinet = cabinets[cabIdx];
  if (!cabinet) {
    console.error('Invalid cabinet selection.');
    process.exit(1);
  }
  cabinet.drawers.forEach((d: any, i: number) => {
    console.log(`${i + 1}: ${d.name} - _id: ${d._id}`);
  });
  const drawerIdx = parseInt(await prompt('Select default drawer by number: '), 10) - 1;
  const drawer = cabinet.drawers[drawerIdx];
  if (!drawer) {
    console.error('Invalid drawer selection.');
    process.exit(1);
  }

  const allStudents = await db.collection('students').find({}).toArray();
  const cabinetIds = new Set(cabinets.map(c => c._id.toString()));
  const drawerIds = new Set(cabinets.flatMap(c => (c.drawers as any[]).map((d: any) => d._id)));
  const invalid = allStudents.filter(s => {
    if (!s.cabinet || !s.drawer) return true;
    if (!cabinetIds.has(s.cabinet)) return true;
    if (!drawerIds.has(s.drawer)) return true;
    return false;
  });
  if (invalid.length === 0) {
    console.log('No students with missing or invalid cabinet/drawer assignments!');
    process.exit(0);
  }
  console.log(`Fixing ${invalid.length} students...`);
  for (const s of invalid) {
    await db.collection('students').updateOne(
      { _id: s._id },
      { $set: { cabinet: cabinet._id.toString(), drawer: drawer._id } }
    );
    console.log(`Fixed student ${s.studentId || s._id}`);
  }
  console.log('Done!');
  await client.close();
}

main().catch(err => { console.error(err); process.exit(1); }); 