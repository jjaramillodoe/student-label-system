import { MongoClient, ObjectId } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'student-label';

async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);

  const cabinets = await db.collection('cabinets').find({}).toArray();
  let fixedCabinets = 0;
  let fixedDrawers = 0;

  for (const cabinet of cabinets) {
    let updateNeeded = false;
    let newCurrentCount = cabinet.currentCount;
    if (typeof newCurrentCount === 'number' && newCurrentCount < 0) {
      newCurrentCount = 0;
      updateNeeded = true;
      fixedCabinets++;
    }
    const newDrawers = (cabinet.drawers || []).map((drawer: any) => {
      if (typeof drawer.currentCount === 'number' && drawer.currentCount < 0) {
        fixedDrawers++;
        updateNeeded = true;
        return { ...drawer, currentCount: 0 };
      }
      return drawer;
    });
    if (updateNeeded) {
      await db.collection('cabinets').updateOne(
        { _id: new ObjectId(cabinet._id) },
        { $set: { currentCount: newCurrentCount, drawers: newDrawers } }
      );
      console.log(`Fixed cabinet ${cabinet.name} (${cabinet._id})`);
    }
  }
  console.log(`Done! Fixed ${fixedCabinets} cabinets and ${fixedDrawers} drawers with negative counts.`);
  await client.close();
}

main().catch(err => { console.error(err); process.exit(1); }); 