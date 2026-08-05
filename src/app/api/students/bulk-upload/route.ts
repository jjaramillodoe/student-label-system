import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { ObjectId } from 'mongodb';
import { authOptions } from '@/lib/authOptions';
import clientPromise from '@/lib/mongodb';
import { generateLabelId, generateStudentId, resolveAgencyId } from '@/lib/studentId';
import { assignDrawerSection } from '@/lib/drawerSections';

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
  phone?: string;
  address?: string;
  apt?: string;
  city?: string;
  state?: string;
  zip?: string;
  addressFlags?: string[];
  addressValidationStatus?: string;
  addressStandardized?: { address: string; apt?: string; city: string; state: string; zip: string };
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

function drawerIdsEqual(a: unknown, b: unknown) {
  return String(a ?? '') === String(b ?? '');
}

function buildStudentDoc(
  student: StudentUploadRow,
  opts: {
    labelId: string;
    studentId: string;
    agencyId: string;
    cabinetId: string;
    drawerId: string;
    drawerSection?: string;
    school: string;
    now: string;
    createdBy: { name: string; email: string };
  },
) {
  const doc: Record<string, unknown> = {
    firstName: student.firstName,
    lastName: student.lastName,
    dob: student.dob,
    fiscalYear: student.fiscalYear,
    status: student.status,
    startDate: student.startDate,
    email: student.email || null,
    phone: student.phone?.trim() || null,
    address: student.address || null,
    apt: student.apt || null,
    city: student.city || null,
    state: student.state || null,
    zip: student.zip || null,
    addressValidationStatus:
      student.addressValidationStatus || (student.address ? 'unverified' : 'empty'),
    labelId: opts.labelId,
    studentId: opts.studentId,
    agencyId: opts.agencyId,
    endDate: null,
    archived: false,
    cabinet: opts.cabinetId,
    drawer: opts.drawerId,
    school: opts.school,
    createdAt: opts.now,
    updatedAt: opts.now,
    createdBy: opts.createdBy,
    importSource: 'bulk-upload',
  };

  if (opts.drawerSection) {
    doc.drawerSection = opts.drawerSection;
  }
  if (student.addressFlags?.length) {
    doc.addressFlags = student.addressFlags;
  }
  if (student.addressStandardized) {
    doc.addressStandardized = student.addressStandardized;
  }
  if (student.addressValidationStatus === 'verified') {
    doc.addressVerifiedAt = opts.now;
  }

  return doc;
}

function bulkUploadErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return 'Failed to bulk upload students';
  }
  const err = error as {
    code?: number;
    codeName?: string;
    message?: string;
    keyValue?: Record<string, unknown>;
  };

  if (err.code === 11000 || err.codeName === 'DuplicateKey') {
    const key = err.keyValue ? Object.keys(err.keyValue)[0] : null;
    const value = key ? err.keyValue?.[key] : null;
    if (key === 'studentId') {
      return `Duplicate student ID already exists (${value}). Someone with the same name and DOB may already be in the system.`;
    }
    if (key === 'labelId') {
      return `Duplicate label ID already exists (${value}). Remove or regenerate that row and try again.`;
    }
    return `Duplicate key conflict${key ? ` on ${key}` : ''}. Check for students already in the system.`;
  }

  const message = typeof err.message === 'string' ? err.message : '';
  const name = (error as { name?: string }).name || '';
  if (
    name === 'MongoServerSelectionError'
    || /server selection timed out/i.test(message)
    || /ReplicaSetNoPrimary/i.test(message)
  ) {
    return 'Database is temporarily unreachable (MongoDB Atlas). Wait a moment and try again — this is not a problem with your CSV.';
  }

  if (message.trim()) {
    return message;
  }
  return 'Failed to bulk upload students';
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

    const cabinetId = String(targetCabinetId || '');
    const drawerId = String(targetDrawerId || '');

    if (!Array.isArray(students) || students.length === 0) {
      return NextResponse.json({ error: 'No students provided' }, { status: 400 });
    }
    if (!isValidObjectId(cabinetId) || !drawerId) {
      return NextResponse.json({ error: 'Invalid storage assignment' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('student-label');
    const cabinetsCollection = db.collection<CabinetDoc>('cabinets');
    const studentsCollection = db.collection('students');
    const targetCabinet = await cabinetsCollection.findOne({ _id: new ObjectId(cabinetId) });

    if (!targetCabinet) {
      return NextResponse.json({ error: 'Target cabinet not found' }, { status: 404 });
    }
    if (role !== 'Admin' && targetCabinet.school !== session.user.school) {
      return NextResponse.json({ error: 'Forbidden for this school' }, { status: 403 });
    }
    if (!targetCabinet.drawers.some(drawer => drawerIdsEqual(drawer._id, drawerId))) {
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
      let foundTarget = false;

      [...cabinets].sort(sortCabinetsByRange).forEach((cabinet) => {
        cabinet.drawers
          .map((drawer, index) => ({ drawer, index }))
          .sort((a, b) => (
            labelToIndex(getDrawerLabel(a.drawer, a.index))
            - labelToIndex(getDrawerLabel(b.drawer, b.index))
          ))
          .forEach(({ drawer }) => {
            if (
              cabinet._id.toString() === cabinetId
              && drawerIdsEqual(drawer._id, drawerId)
            ) {
              include = true;
              foundTarget = true;
            }
            if (!include) return;

            const available = (drawer.capacity || 0) - (drawer.currentCount || 0);
            if (available > 0) {
              drawers.push({ cabinet, drawer, available });
            }
          });
      });

      return { drawers, foundTarget };
    }

    let { drawers: availableDrawers, foundTarget } = getAvailableDrawers();
    if (!foundTarget) {
      return NextResponse.json({
        error: 'Could not allocate to the selected drawer. Re-select the cabinet/drawer and try again.',
      }, { status: 400 });
    }
    let availableCount = availableDrawers.reduce((sum, item) => sum + item.available, 0);

    const MAX_AUTO_CABINETS = 25;
    let autoCreateAttempts = 0;
    while (autoCreateCabinets && availableCount < students.length) {
      if (autoCreateAttempts >= MAX_AUTO_CABINETS) {
        return NextResponse.json({
          error: `Could not create enough cabinet space after ${MAX_AUTO_CABINETS} new cabinets. ${availableCount} spaces available for ${students.length} students.`,
        }, { status: 400 });
      }
      autoCreateAttempts += 1;

      const ends = cabinets.map(getCabinetEndIndex).filter((n) => Number.isFinite(n));
      const nextStartIndex = (ends.length ? Math.max(...ends) : 0) + 1;
      const nextCabinet = cloneNextCabinet(targetCabinet, nextStartIndex);
      const insertResult = await db.collection('cabinets').insertOne(nextCabinet);
      const cabinetWithId = { ...nextCabinet, _id: insertResult.insertedId } as CabinetDoc;

      cabinets.push(cabinetWithId);
      createdCabinets.push(cabinetWithId);
      ({ drawers: availableDrawers } = getAvailableDrawers());
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
    type PrefixGroup = { students: typeof students; nextCounter: number };
    const prefixGroups = new Map<string, PrefixGroup>();
    for (const s of students) {
      if (s.labelId) continue;
      const initials = `${(s.firstName?.[0] || '').toUpperCase()}${(s.lastName?.[0] || '').toUpperCase()}`;
      const birthYear = s.dob?.split('-')[0] || '0000';
      const prefix = `${birthYear}-${initials}`;
      if (!prefixGroups.has(prefix)) prefixGroups.set(prefix, { students: [], nextCounter: 1 });
      prefixGroups.get(prefix)!.students.push(s);
    }

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
      }),
    );

    const prefixCounters = new Map<string, number>();
    for (const [prefix, group] of prefixGroups) {
      prefixCounters.set(prefix, group.nextCounter);
    }

    // ── Build documents ───────────────────────────────────────────────────────
    const cabinetUpdates = new Map<string, { cabinetId: ObjectId; drawerId: string; count: number }>();
    const plannedStudentIds: string[] = [];

    const docs = students.map((student) => {
      const slot = availableDrawers.find(item => item.available > 0);
      if (!slot) throw new Error('No available drawer slot');

      slot.available--;
      const slotDrawerId = String(slot.drawer._id);
      const updateKey = `${slot.cabinet._id.toString()}:${slotDrawerId}`;
      const existingUpdate = cabinetUpdates.get(updateKey);
      const alreadyInBatch = existingUpdate?.count || 0;
      const indexInDrawer = (slot.drawer.currentCount || 0) + alreadyInBatch;
      const drawerSection = assignDrawerSection(indexInDrawer, slot.drawer.capacity || 400);
      cabinetUpdates.set(updateKey, {
        cabinetId: slot.cabinet._id,
        drawerId: slotDrawerId,
        count: alreadyInBatch + 1,
      });

      let labelId = student.labelId || '';
      if (!labelId && student.firstName && student.lastName && student.dob) {
        const initials = `${(student.firstName[0] || '').toUpperCase()}${(student.lastName[0] || '').toUpperCase()}`;
        const birthYear = student.dob.split('-')[0] || '0000';
        const prefix = `${birthYear}-${initials}`;
        const counter = prefixCounters.get(prefix) ?? 1;
        labelId = generateLabelId(student.firstName, student.lastName, student.dob, counter);
        prefixCounters.set(prefix, counter + 1);
      }

      const studentId =
        student.firstName && student.lastName && student.dob
          ? generateStudentId(student.firstName, student.lastName, agencyId, student.dob)
          : '';

      if (studentId) plannedStudentIds.push(studentId);

      return buildStudentDoc(student, {
        labelId,
        studentId,
        agencyId,
        cabinetId: slot.cabinet._id.toString(),
        drawerId: slotDrawerId,
        drawerSection,
        school,
        now,
        createdBy: {
          name: session.user.name || session.user.email || 'Unknown',
          email: session.user.email || '',
        },
      });
    });

    // Preflight unique studentId collisions (sparse unique index)
    const duplicateInBatch = plannedStudentIds.filter((id, i) => plannedStudentIds.indexOf(id) !== i);
    if (duplicateInBatch.length > 0) {
      return NextResponse.json({
        error: `Duplicate student IDs within upload (same name + DOB): ${[...new Set(duplicateInBatch)].slice(0, 5).join(', ')}`,
      }, { status: 400 });
    }

    if (plannedStudentIds.length > 0) {
      const existingIds = await studentsCollection
        .find({ studentId: { $in: plannedStudentIds } })
        .project({ studentId: 1, firstName: 1, lastName: 1, dob: 1 })
        .toArray();
      if (existingIds.length > 0) {
        const sample = existingIds
          .slice(0, 5)
          .map((s) => `${s.lastName || ''} ${s.firstName || ''} (${s.studentId})`.trim())
          .join('; ');
        return NextResponse.json({
          error: `Cannot upload — ${existingIds.length} student(s) already exist with the same name/DOB identity. Examples: ${sample}`,
        }, { status: 409 });
      }
    }

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
    return NextResponse.json({ error: bulkUploadErrorMessage(error) }, { status: 500 });
  }
}
