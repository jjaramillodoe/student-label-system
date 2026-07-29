import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import clientPromise from '@/lib/mongodb';
import {
  LEGACY_ROSTER_COLLECTION,
  parseLegacyCsv,
  parseMdbBuffer,
  type LegacyRosterMeta,
} from '@/lib/legacyRoster';

function canManageSchool(
  role: string | undefined,
  userSchool: string | undefined,
  targetSchool: string,
) {
  if (role === 'Admin') return true;
  if (role === 'Data Lead' && userSchool && userSchool === targetSchool) return true;
  return false;
}

/** GET ?school=Name — roster status for a school */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const role = session.user?.role;
    const userSchool = session.user?.school;
    const school = req.nextUrl.searchParams.get('school')?.trim()
      || (role !== 'Admin' ? userSchool : '')
      || '';

    if (!school) {
      return NextResponse.json({ error: 'school query required' }, { status: 400 });
    }
    if (!canManageSchool(role, userSchool, school) && !['Intake Member', 'Data Member', 'Data Lead', 'Admin'].includes(role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    // Intake/Data Member can read status for their school only
    if (role !== 'Admin' && userSchool && school !== userSchool) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const client = await clientPromise;
    const db = client.db('student-label');
    const config = await db.collection('school_config').findOne({ name: school });
    const meta = (config?.legacyRoster as LegacyRosterMeta | undefined) || null;
    const count = await db.collection(LEGACY_ROSTER_COLLECTION).countDocuments({ school });

    return NextResponse.json({
      school,
      meta: meta ? { ...meta, rowCount: count || meta.rowCount } : null,
      rowCount: count,
    });
  } catch (error) {
    console.error('legacy-roster GET', error);
    return NextResponse.json({ error: 'Failed to load roster status' }, { status: 500 });
  }
}

/** POST multipart: file + school — replace roster for school */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const role = session.user?.role;
    const userSchool = session.user?.school;

    const form = await req.formData();
    const file = form.get('file');
    const schoolField = String(form.get('school') || '').trim();
    const preferredTable = String(form.get('table') || '').trim() || undefined;
    const school = schoolField || (role === 'Data Lead' ? userSchool || '' : '');

    if (!school) {
      return NextResponse.json({ error: 'School is required' }, { status: 400 });
    }
    if (!canManageSchool(role, userSchool, school)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Upload an .mdb or .csv file' }, { status: 400 });
    }

    const filename = file.name || 'roster';
    const lower = filename.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > 12 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large (max 12 MB). Export a CSV of students if needed.' },
        { status: 400 },
      );
    }

    let parsed;
    if (lower.endsWith('.mdb') || lower.endsWith('.accdb')) {
      parsed = parseMdbBuffer(buffer, school, filename, preferredTable);
    } else if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
      parsed = parseLegacyCsv(buffer.toString('utf8'), school, filename);
    } else {
      return NextResponse.json(
        { error: 'Unsupported file type. Upload .mdb, .accdb, or .csv' },
        { status: 400 },
      );
    }

    const client = await clientPromise;
    const db = client.db('student-label');
    const col = db.collection(LEGACY_ROSTER_COLLECTION);

    await col.deleteMany({ school });
    if (parsed.rows.length) {
      await col.insertMany(parsed.rows);
    }
    await col.createIndex({ school: 1, lastName: 1, firstName: 1 });
    await col.createIndex({ school: 1, dob: 1 });

    const meta: LegacyRosterMeta = {
      uploadedAt: new Date().toISOString(),
      filename,
      rowCount: parsed.rows.length,
      tableName: parsed.tableName,
      sourceType: lower.endsWith('.csv') || lower.endsWith('.txt') ? 'csv' : 'mdb',
      uploadedBy: {
        name: session.user?.name || undefined,
        email: session.user?.email || undefined,
      },
    };

    await db.collection('school_config').updateOne(
      { name: school },
      {
        $set: {
          name: school,
          legacyRoster: meta,
          updatedAt: new Date().toISOString(),
        },
        $setOnInsert: {
          type: 'School',
          active: true,
          createdAt: new Date().toISOString(),
        },
      },
      { upsert: true },
    );

    return NextResponse.json({
      ok: true,
      school,
      meta,
      mapping: parsed.mapping,
      tableName: parsed.tableName,
      tableNames: parsed.tableNames,
    });
  } catch (error) {
    console.error('legacy-roster POST', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import roster' },
      { status: 500 },
    );
  }
}

/** DELETE ?school=Name — clear roster */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const role = session.user?.role;
    const userSchool = session.user?.school;
    const school = req.nextUrl.searchParams.get('school')?.trim()
      || (role === 'Data Lead' ? userSchool || '' : '');

    if (!school) {
      return NextResponse.json({ error: 'school query required' }, { status: 400 });
    }
    if (!canManageSchool(role, userSchool, school)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const client = await clientPromise;
    const db = client.db('student-label');
    const result = await db.collection(LEGACY_ROSTER_COLLECTION).deleteMany({ school });
    await db.collection('school_config').updateOne(
      { name: school },
      { $unset: { legacyRoster: '' }, $set: { updatedAt: new Date().toISOString() } },
    );

    return NextResponse.json({ ok: true, deleted: result.deletedCount });
  } catch (error) {
    console.error('legacy-roster DELETE', error);
    return NextResponse.json({ error: 'Failed to clear roster' }, { status: 500 });
  }
}
