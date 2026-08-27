import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/requireSession';
import clientPromise from '@/lib/mongodb';
import {
  LEGACY_ROSTER_COLLECTION,
  parseLegacyCsv,
  parseMdbBuffer,
  schoolConfigNameFilter,
  schoolNameFilter,
  type LegacyRosterMeta,
  type LegacyRosterRow,
} from '@/lib/legacyRoster';

export const runtime = 'nodejs';
export const maxDuration = 60;

function sameSchool(a?: string | null, b?: string | null) {
  return Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());
}

function canManageSchool(
  role: string | undefined,
  userSchool: string | undefined,
  targetSchool: string,
) {
  if (role === 'Admin') return true;
  if (role === 'Data Lead' && sameSchool(userSchool, targetSchool)) return true;
  return false;
}

async function resolveCanonicalSchoolName(db: any, preferred: string) {
  const config = await db.collection('school_config').findOne(schoolConfigNameFilter(preferred));
  return (config?.name as string) || preferred.trim();
}

function slimRow(row: Partial<LegacyRosterRow>, school: string, importedAt: string, filename: string, sourceType: 'mdb' | 'csv', tableName?: string): LegacyRosterRow | null {
  const firstName = String(row.firstName || '').trim();
  const lastName = String(row.lastName || '').trim();
  if (!firstName || !lastName) return null;
  return {
    school,
    firstName,
    lastName,
    dob: String(row.dob || '').trim(),
    externalId: row.externalId ? String(row.externalId).trim() : undefined,
    sourceTable: tableName || row.sourceTable,
    sourceFilename: filename,
    sourceType,
    importedAt,
  };
}

/** GET ?school=Name — roster status for a school */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireSession();
    if (!auth.ok) return auth.response;

    const role = auth.user?.role;
    const userSchool = auth.user?.school;
    const school = req.nextUrl.searchParams.get('school')?.trim()
      || (role !== 'Admin' ? userSchool : '')
      || '';

    if (!school) {
      return NextResponse.json({ error: 'school query required' }, { status: 400 });
    }

    const canRead =
      role === 'Admin'
      || (role === 'Data Lead' && sameSchool(userSchool, school))
      || (['Intake Member', 'Data Member'].includes(role || '') && sameSchool(userSchool, school));

    if (!canRead) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const client = await clientPromise;
    const db = client.db('student-label');
    const config = await db.collection('school_config').findOne(schoolConfigNameFilter(school));
    const meta = (config?.legacyRoster as LegacyRosterMeta | undefined) || null;
    const count = await db.collection(LEGACY_ROSTER_COLLECTION).countDocuments(schoolNameFilter(school));

    return NextResponse.json({
      school: config?.name || school,
      meta: meta ? { ...meta, rowCount: count || meta.rowCount } : null,
      rowCount: count,
    });
  } catch (error) {
    console.error('legacy-roster GET', error);
    return NextResponse.json({ error: 'Failed to load roster status' }, { status: 500 });
  }
}

/**
 * POST — prefer JSON body with pre-parsed rows (client-side MDB parse).
 * Also still accepts small multipart file uploads as a fallback.
 *
 * JSON shapes:
 *   { mode: 'replace', school, filename, sourceType, tableName?, rows: LegacyRosterRow[] }
 *   { mode: 'append', school, filename, sourceType, tableName?, rows, finalize?: boolean, meta?: Partial }
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireSession();
    if (!auth.ok) return auth.response;

    const role = auth.user?.role;
    const userSchool = auth.user?.school;
    const contentType = req.headers.get('content-type') || '';

    // ── JSON path (preferred — avoids Vercel "Request Entity Too Large" on big MDBs) ──
    if (contentType.includes('application/json')) {
      const body = await req.json();
      const mode = body.mode === 'append' ? 'append' : 'replace';
      const schoolField = String(body.school || '').trim();
      const requestedSchool =
        role === 'Data Lead'
          ? (schoolField || userSchool || '').trim()
          : schoolField;

      if (!requestedSchool) {
        return NextResponse.json(
          { error: role === 'Data Lead' ? 'Your account has no school assigned' : 'School is required' },
          { status: 400 },
        );
      }
      if (!canManageSchool(role, userSchool, requestedSchool)) {
        return NextResponse.json(
          { error: 'Forbidden — Data Leads can only upload a roster for their own school' },
          { status: 403 },
        );
      }

      const client = await clientPromise;
      const db = client.db('student-label');
      const school = await resolveCanonicalSchoolName(db, requestedSchool);
      const filename = String(body.filename || 'roster').slice(0, 200);
      const sourceType: 'mdb' | 'csv' = body.sourceType === 'csv' ? 'csv' : 'mdb';
      const tableName = body.tableName ? String(body.tableName) : undefined;
      const importedAt = new Date().toISOString();
      const incomingRows = Array.isArray(body.rows) ? body.rows : [];
      if (incomingRows.length > 25000) {
        return NextResponse.json(
          { error: 'Too many rows in one request (max 25,000). Upload in smaller batches.' },
          { status: 400 },
        );
      }

      const rows = incomingRows
        .map((r: Partial<LegacyRosterRow>) => slimRow(r, school, importedAt, filename, sourceType, tableName))
        .filter(Boolean) as LegacyRosterRow[];

      const col = db.collection(LEGACY_ROSTER_COLLECTION);
      if (mode === 'replace') {
        await col.deleteMany(schoolNameFilter(school));
      }
      if (rows.length) {
        await col.insertMany(rows, { ordered: false });
      }
      await col.createIndex({ school: 1, lastName: 1, firstName: 1 });
      await col.createIndex({ school: 1, dob: 1 });

      const count = await col.countDocuments(schoolNameFilter(school));
      const shouldFinalize = mode === 'replace' || body.finalize === true;
      let meta: LegacyRosterMeta | null = null;

      if (shouldFinalize) {
        meta = {
          uploadedAt: importedAt,
          filename,
          rowCount: count,
          tableName,
          sourceType,
          uploadedBy: {
            name: auth.user?.name || undefined,
            email: auth.user?.email || undefined,
          },
        };
        await db.collection('school_config').updateOne(
          schoolConfigNameFilter(school),
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
      }

      return NextResponse.json({
        ok: true,
        school,
        mode,
        inserted: rows.length,
        rowCount: count,
        meta,
        tableName,
      });
    }

    // ── Multipart fallback for small files only ──
    const form = await req.formData();
    const file = form.get('file');
    const schoolField = String(form.get('school') || '').trim();
    const preferredTable = String(form.get('table') || '').trim() || undefined;
    const requestedSchool =
      role === 'Data Lead'
        ? (schoolField || userSchool || '').trim()
        : schoolField;

    if (!requestedSchool) {
      return NextResponse.json(
        { error: role === 'Data Lead' ? 'Your account has no school assigned' : 'School is required' },
        { status: 400 },
      );
    }
    if (!canManageSchool(role, userSchool, requestedSchool)) {
      return NextResponse.json(
        { error: 'Forbidden — Data Leads can only upload a roster for their own school' },
        { status: 403 },
      );
    }
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Upload an .mdb or .csv file' }, { status: 400 });
    }

    // Vercel request body limit is ~4.5MB — reject early with a clear message
    if (file.size > 3.5 * 1024 * 1024) {
      return NextResponse.json(
        {
          error:
            'File is too large for direct upload (Vercel limit ~4.5 MB). The app should parse .mdb in the browser and send student rows only — refresh the page and try again, or export a CSV of First Name / Last Name / DOB.',
        },
        { status: 413 },
      );
    }

    const client = await clientPromise;
    const db = client.db('student-label');
    const school = await resolveCanonicalSchoolName(db, requestedSchool);

    const filename = file.name || 'roster';
    const lower = filename.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());

    let parsed;
    if (lower.endsWith('.mdb') || lower.endsWith('.accdb')) {
      parsed = await parseMdbBuffer(buffer, school, filename, preferredTable);
    } else if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
      parsed = parseLegacyCsv(buffer.toString('utf8'), school, filename);
    } else {
      return NextResponse.json(
        { error: 'Unsupported file type. Upload .mdb, .accdb, or .csv' },
        { status: 400 },
      );
    }

    const rows = parsed.rows.map(r => ({ ...r, school }));
    const col = db.collection(LEGACY_ROSTER_COLLECTION);
    await col.deleteMany(schoolNameFilter(school));
    if (rows.length) await col.insertMany(rows);
    await col.createIndex({ school: 1, lastName: 1, firstName: 1 });
    await col.createIndex({ school: 1, dob: 1 });

    const meta: LegacyRosterMeta = {
      uploadedAt: new Date().toISOString(),
      filename,
      rowCount: rows.length,
      tableName: parsed.tableName,
      sourceType: lower.endsWith('.csv') || lower.endsWith('.txt') ? 'csv' : 'mdb',
      uploadedBy: {
        name: auth.user?.name || undefined,
        email: auth.user?.email || undefined,
      },
    };

    await db.collection('school_config').updateOne(
      schoolConfigNameFilter(school),
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
    const auth = await requireSession();
    if (!auth.ok) return auth.response;

    const role = auth.user?.role;
    const userSchool = auth.user?.school;
    const schoolParam = req.nextUrl.searchParams.get('school')?.trim() || '';
    const requestedSchool =
      role === 'Data Lead'
        ? (schoolParam || userSchool || '').trim()
        : schoolParam;

    if (!requestedSchool) {
      return NextResponse.json({ error: 'school query required' }, { status: 400 });
    }
    if (!canManageSchool(role, userSchool, requestedSchool)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const client = await clientPromise;
    const db = client.db('student-label');
    const school = await resolveCanonicalSchoolName(db, requestedSchool);

    const result = await db.collection(LEGACY_ROSTER_COLLECTION).deleteMany(schoolNameFilter(school));
    await db.collection('school_config').updateOne(
      schoolConfigNameFilter(school),
      { $unset: { legacyRoster: '' }, $set: { updatedAt: new Date().toISOString() } },
    );

    return NextResponse.json({ ok: true, deleted: result.deletedCount, school });
  } catch (error) {
    console.error('legacy-roster DELETE', error);
    return NextResponse.json({ error: 'Failed to clear roster' }, { status: 500 });
  }
}
