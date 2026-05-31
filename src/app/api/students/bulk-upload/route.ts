import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { ObjectId } from 'mongodb';
import { authOptions } from '@/lib/authOptions';
import clientPromise from '@/lib/mongodb';
import { generateLabelId, generateStudentId, resolveAgencyId } from '@/lib/studentId';

type DrawerDoc = {
  _id: string;
  name: string;
  capacity: number;
  currentCount?: number;
};

type CabinetDoc = {
  _id: ObjectId;
  name: string;
  identifier?: string | null;
  school?: string;
  totalCapacity?: number;
  currentCount?: number;
  drawers: DrawerDoc[];
};

type NewCabinetDoc = Omit<CabinetDoc, '_id'> & {
  createdAt: string;
  updatedAt: string;
};

type StudentUploadRow = {
  firstName: string;
  lastName: string;
  dob: string;
  fiscalYear: string;
  status: string;
  startDate: string;
  email?: string;
  /** Barcode label ID supplied by the client preview (may be absent for legacy uploads) */
  labelId?: string;
  /** Legacy field — ignored on upload; server generates the new demographic ID */
  studentId?: string;
};

function isValidObjectId(id: string) {
  try {
    new ObjectId(id);
    return true;
  } catch {
    return false;
  }
}

function labelToIndex(label: string) {
  return label.toUpperCase().split('').reduce((value, char) => (
    value * 26 + char.charCodeAt(0) - 64
  ), 0) - 1;
}

function indexToLabel(index: number) {
  let value = index + 1;
  let label = '';

  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }

  return label;
}

function extractTrailingLabel(value?: string | null) {
  const match = value?.trim().match(/([A-Z]+)\s*$/i);
  return match ? match[1].toUpperCase() : null;
}

function getDrawerLabel(drawer: DrawerDoc, fallbackIndex: number) {
  return extractTrailingLabel(drawer.name) || indexToLabel(fallbackIndex);
}

function getCabinetStartIndex(cabinet: CabinetDoc) {
  const rangeMatch = cabinet.identifier?.match(/^\s*([A-Z]+)\s*-\s*([A-Z]+)\s*$/i);
  if (rangeMatch) return labelToIndex(rangeMatch[1]);

  const firstDrawer = cabinet.drawers[0];
  return firstDrawer ? labelToIndex(getDrawerLabel(firstDrawer, 0)) : 0;
}

function getCabinetEndIndex(cabinet: CabinetDoc) {
  const rangeMatch = cabinet.identifier?.match(/^\s*([A-Z]+)\s*-\s*([A-Z]+)\s*$/i);
  if (rangeMatch) return labelToIndex(rangeMatch[2]);

  return cabinet.drawers.reduce((max, drawer, index) => (
    Math.max(max, labelToIndex(getDrawerLabel(drawer, index)))
  ), 0);
}

function sortCabinetsByRange(a: CabinetDoc, b: CabinetDoc) {
  return getCabinetStartIndex(a) - getCabinetStartIndex(b);
}

function cloneNextCabinet(template: CabinetDoc, startIndex: number): NewCabinetDoc {
  const drawers = template.drawers.map((drawer, index) => {
    const label = indexToLabel(startIndex + index);
    return {
      _id: new ObjectId().toString(),
      name: `Drawer ${label}`,
      capacity: drawer.capacity || 100,
      currentCount: 0,
    };
  });
  const endIndex = startIndex + drawers.length - 1;

  return {
    name: template.name,
    identifier: `${indexToLabel(startIndex)}-${indexToLabel(endIndex)}`,
    school: template.school,
    drawers,
    totalCapacity: drawers.reduce((sum, drawer) => sum + drawer.capacity, 0),
    currentCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = session.user.role;
    if (!['Admin', 'Data Lead', 'Data Member'].includes(role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const {
      students,
      targetCabinetId,
      targetDrawerId,
      autoCreateCabinets = true,
    } = await req.json() as {
      students: StudentUploadRow[];
      targetCabinetId: string;
      targetDrawerId: string;
      autoCreateCabinets?: boolean;
    };

    if (!Array.isArray(students) || students.length === 0) {
      return NextResponse.json({ error: 'No students provided' }, { status: 400 });
    }
    if (!isValidObjectId(targetCabinetId) || !targetDrawerId) {
      return NextResponse.json({ error: 'Invalid storage assignment' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('student-label');
    const cabinetsCollection = db.collection<CabinetDoc>('cabinets');
    const studentsCollection = db.collection('students');
    const targetCabinet = await cabinetsCollection.findOne({ _id: new ObjectId(targetCabinetId) });

    if (!targetCabinet) {
      return NextResponse.json({ error: 'Target cabinet not found' }, { status: 404 });
    }
    if (role !== 'Admin' && targetCabinet.school !== session.user.school) {
      return NextResponse.json({ error: 'Forbidden for this school' }, { status: 403 });
    }
    if (!targetCabinet.drawers.some(drawer => drawer._id === targetDrawerId)) {
      return NextResponse.json({ error: 'Target drawer not found' }, { status: 404 });
    }

    const matchingCabinets = await cabinetsCollection
      .find({ school: targetCabinet.school, name: targetCabinet.name })
      .toArray();
    const cabinets = matchingCabinets.sort(sortCabinetsByRange);
    const createdCabinets: CabinetDoc[] = [];

    function getAvailableDrawers() {
      const drawers: Array<{ cabinet: CabinetDoc; drawer: DrawerDoc; available: number }> = [];
      let include = false;

      cabinets.sort(sortCabinetsByRange).forEach((cabinet) => {
        const sortedDrawers = [...cabinet.drawers].sort((a, b) => (
          labelToIndex(getDrawerLabel(a, 0)) - labelToIndex(getDrawerLabel(b, 0))
        ));

        sortedDrawers.forEach((drawer) => {
          if (cabinet._id.toString() === targetCabinetId && drawer._id === targetDrawerId) {
            include = true;
          }
          if (!include) return;

          const available = (drawer.capacity || 0) - (drawer.currentCount || 0);
          if (available > 0) {
            drawers.push({ cabinet, drawer, available });
          }
        });
      });

      return drawers;
    }

    let availableDrawers = getAvailableDrawers();
    let availableCount = availableDrawers.reduce((sum, item) => sum + item.available, 0);

    while (autoCreateCabinets && availableCount < students.length) {
      const nextStartIndex = Math.max(...cabinets.map(getCabinetEndIndex)) + 1;
      const nextCabinet = cloneNextCabinet(targetCabinet, nextStartIndex);
      const insertResult = await db.collection('cabinets').insertOne(nextCabinet);
      const cabinetWithId = { ...nextCabinet, _id: insertResult.insertedId } as CabinetDoc;

      cabinets.push(cabinetWithId);
      createdCabinets.push(cabinetWithId);
      availableDrawers = getAvailableDrawers();
      availableCount = availableDrawers.reduce((sum, item) => sum + item.available, 0);
    }

    if (availableCount < students.length) {
      return NextResponse.json({
        error: `Not enough drawer capacity. ${availableCount} spaces available for ${students.length} students.`,
      }, { status: 400 });
    }

    const now = new Date().toISOString();
    const school = targetCabinet.school || '';

    // ── Resolve agency ID for this school ────────────────────────────────────
    const schoolDoc = await db.collection('school_config').findOne({
      name: { $regex: `^${school.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
    });
    const agencyId = resolveAgencyId(school, schoolDoc?.agencyId);

    // ── Pre-compute labelId counters per {year}-{initials} prefix ─────────────
    // Group students by prefix so we can query existing max counters in bulk.
    type PrefixGroup = { students: typeof students; nextCounter: number };
    const prefixGroups = new Map<string, PrefixGroup>();
    for (const s of students) {
      if (s.labelId) continue; // client already generated it — skip
      const initials = `${(s.firstName?.[0] || '').toUpperCase()}${(s.lastName?.[0] || '').toUpperCase()}`;
      const birthYear = s.dob?.split('-')[0] || '0000';
      const prefix = `${birthYear}-${initials}`;
      if (!prefixGroups.has(prefix)) prefixGroups.set(prefix, { students: [], nextCounter: 1 });
      prefixGroups.get(prefix)!.students.push(s);
    }

    // Query existing max counter for each prefix once (not per student)
    await Promise.all(
      Array.from(prefixGroups.entries()).map(async ([prefix, group]) => {
        const pattern = new RegExp(`^${prefix}-\\d{7}$`);
        const existing = await studentsCollection
          .find({ $or: [{ labelId: { $regex: pattern } }, { studentId: { $regex: pattern } }] })
          .project({ labelId: 1, studentId: 1 })
          .toArray();
        if (existing.length > 0) {
          const max = existing.reduce((acc, s) => {
            const idStr = s.labelId || s.studentId || '';
            const match = idStr.match(/-(\d{7})$/);
            return Math.max(acc, match ? parseInt(match[1], 10) : 0);
          }, 0);
          group.nextCounter = max + 1;
        }
      })
    );

    // Assign counters within each prefix group to avoid collisions
    const prefixCounters = new Map<string, number>();
    for (const [prefix, group] of prefixGroups) {
      prefixCounters.set(prefix, group.nextCounter);
    }

    // ── Build documents ───────────────────────────────────────────────────────
    const cabinetUpdates = new Map<string, { cabinetId: ObjectId; drawerId: string; count: number }>();
    const docs = students.map((student) => {
      const slot = availableDrawers.find(item => item.available > 0);
      if (!slot) throw new Error('No available drawer slot');

      slot.available--;
      const updateKey = `${slot.cabinet._id.toString()}:${slot.drawer._id}`;
      const existingUpdate = cabinetUpdates.get(updateKey);
      cabinetUpdates.set(updateKey, {
        cabinetId: slot.cabinet._id,
        drawerId: slot.drawer._id,
        count: (existingUpdate?.count || 0) + 1,
      });

      // Resolve labelId
      let labelId = student.labelId || '';
      if (!labelId && student.firstName && student.lastName && student.dob) {
        const initials = `${(student.firstName[0] || '').toUpperCase()}${(student.lastName[0] || '').toUpperCase()}`;
        const birthYear = student.dob.split('-')[0] || '0000';
        const prefix = `${birthYear}-${initials}`;
        const counter = prefixCounters.get(prefix) ?? 1;
        labelId = generateLabelId(student.firstName, student.lastName, student.dob, counter);
        prefixCounters.set(prefix, counter + 1);
      }

      // Generate demographic studentId
      const studentId =
        student.firstName && student.lastName && student.dob
          ? generateStudentId(student.firstName, student.lastName, agencyId, student.dob)
          : '';

      // Strip legacy studentId from CSV row before storing
      const { studentId: _ignored, labelId: _labelIgnored, ...rest } = student as any;

      return {
        ...rest,
        labelId,
        studentId,
        agencyId,
        email: student.email || null,
        endDate: null,
        archived: false,
        cabinet: slot.cabinet._id.toString(),
        drawer: slot.drawer._id,
        school,
        createdAt: now,
      };
    });

    await studentsCollection.insertMany(docs);

    if (cabinetUpdates.size > 0) {
      await cabinetsCollection.bulkWrite(Array.from(cabinetUpdates.values()).map(update => ({
        updateOne: {
          filter: { _id: update.cabinetId, 'drawers._id': update.drawerId },
          update: {
            $inc: {
              currentCount: update.count,
              'drawers.$.currentCount': update.count,
            },
            $set: { updatedAt: now },
          },
        },
      })));
    }

    return NextResponse.json({
      insertedCount: docs.length,
      cabinetsCreated: createdCabinets.length,
      createdCabinets: createdCabinets.map(cabinet => ({
        _id: cabinet._id.toString(),
        name: cabinet.name,
        identifier: cabinet.identifier,
      })),
    });
  } catch (error) {
    console.error('Error bulk uploading students:', error);
    return NextResponse.json({ error: 'Failed to bulk upload students' }, { status: 500 });
  }
}
