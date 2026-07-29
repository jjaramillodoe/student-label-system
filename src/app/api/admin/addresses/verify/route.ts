import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import {
  verifyAddressWithGeoclient,
  verifyAddressesBatch,
  type AddressGeoclientVerification,
} from '@/lib/addressGeoclient';
import { isGeoclientConfigured } from '@/lib/nycGeoclient';

const VERIFY_ROLES = ['Admin', 'Data Lead', 'Data Member', 'Intake Member'];

function isValidObjectId(id: string) {
  try {
    new ObjectId(id);
    return true;
  } catch {
    return false;
  }
}

type PreviewRow = {
  index?: number;
  address?: string;
  apt?: string;
  city?: string;
  state?: string;
  zip?: string;
};

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session || !VERIFY_ROLES.includes(role || '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({
    configured: isGeoclientConfigured(),
    provider: 'NYC Geoclient',
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const school = (session?.user as { school?: string })?.school;

  if (!session || !VERIFY_ROLES.includes(role || '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!isGeoclientConfigured()) {
    return NextResponse.json({
      error: 'NYC Geoclient is not configured. Set NYC_GEOCLIENT_SUBSCRIPTION_KEY (or NYC_GEOCLIENT_APP_KEY) from the NYC API portal.',
    }, { status: 503 });
  }

  const body = await req.json() as {
    mode?: 'preview' | 'students' | 'unverified';
    rows?: PreviewRow[];
    studentIds?: string[];
    school?: string;
    apply?: boolean;
    limit?: number;
  };

  const limit = Math.min(Math.max(body.limit ?? 50, 1), 100);

  if (body.mode === 'preview' || Array.isArray(body.rows)) {
    const rows = (body.rows || []).slice(0, limit);
    const batch = rows.map((row, i) => ({
      key: row.index ?? i,
      input: {
        address: row.address,
        apt: row.apt,
        city: row.city,
        state: row.state,
        zip: row.zip,
      },
    }));

    const results = await verifyAddressesBatch(batch, { delayMs: 100 });
    const payload = [...results.entries()].map(([key, result]) => ({
      index: key,
      ...result,
    }));

    return NextResponse.json({
      mode: 'preview',
      count: payload.length,
      results: payload,
    });
  }

  const client = await clientPromise;
  const db = client.db('student-label');

  let students: {
    _id: ObjectId;
    firstName?: string;
    lastName?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
  }[] = [];
  let remainingUnverified: number | undefined;
  let unverifiedQuery: Record<string, unknown> | undefined;

  if (body.mode === 'unverified') {
    unverifiedQuery = {
      address: { $exists: true, $nin: [null, ''] },
      $or: [
        { addressValidationStatus: { $in: [null, '', 'unverified'] } },
        { addressValidationStatus: { $exists: false } },
        { addressVerifiedAt: { $exists: false } },
      ],
    };
    if (role !== 'Admin' && school) {
      unverifiedQuery.school = school;
    } else if (role === 'Admin' && body.school?.trim()) {
      unverifiedQuery.school = body.school.trim();
    }

    remainingUnverified = await db.collection('students').countDocuments(unverifiedQuery);
    students = await db.collection('students')
      .find(unverifiedQuery)
      .sort({ lastName: 1, firstName: 1 })
      .limit(limit)
      .toArray();
  } else {
    const ids = (body.studentIds || []).filter(isValidObjectId).slice(0, limit);
    if (ids.length === 0) {
      return NextResponse.json({ error: 'No valid student IDs provided.' }, { status: 400 });
    }

    const objectIds = ids.map(id => new ObjectId(id));
    const query: Record<string, unknown> = { _id: { $in: objectIds } };
    if (role !== 'Admin' && school) {
      query.school = school;
    }

    students = await db.collection('students').find(query).toArray();
  }

  if (students.length === 0) {
    return NextResponse.json({
      mode: body.mode === 'unverified' ? 'unverified' : 'students',
      count: 0,
      applied: 0,
      remainingUnverified: remainingUnverified ?? 0,
      results: [],
      message: body.mode === 'unverified'
        ? 'No unverified addresses found for the current scope.'
        : 'No matching students found.',
    });
  }

  const batch = students.map(s => ({
    key: s._id.toString(),
    input: {
      address: s.address as string | undefined,
      apt: (s as { apt?: string }).apt,
      city: s.city as string | undefined,
      state: s.state as string | undefined,
      zip: s.zip as string | undefined,
    },
  }));

  const results = await verifyAddressesBatch(batch, { delayMs: 100 });
  const now = new Date().toISOString();
  const updated: string[] = [];

  if (body.apply) {
    for (const student of students) {
      const id = student._id.toString();
      const verification = results.get(id);
      if (!verification || verification.status === 'empty') continue;

      const setFields: Record<string, unknown> = {
        addressValidationStatus: verification.status,
        addressFlags: verification.flags,
        addressWarnings: verification.warnings,
        addressGeoclient: verification.geoclient,
        addressVerifiedAt: now,
        updatedAt: now,
      };

      if (verification.standardized && ['verified', 'warning'].includes(verification.status)) {
        setFields.address = verification.standardized.address || null;
        setFields.apt = verification.standardized.apt || null;
        setFields.city = verification.standardized.city || null;
        setFields.state = verification.standardized.state || null;
        setFields.zip = verification.standardized.zip || null;
        setFields.addressStandardized = verification.standardized;
      }

      await db.collection('students').updateOne(
        { _id: student._id },
        { $set: setFields },
      );
      updated.push(id);
    }
  }

  const payload = students.map(s => {
    const id = s._id.toString();
    const verification = results.get(id) as AddressGeoclientVerification | undefined;
    return {
      studentId: id,
      firstName: s.firstName,
      lastName: s.lastName,
      ...verification,
    };
  });

  if (body.apply && unverifiedQuery) {
    remainingUnverified = await db.collection('students').countDocuments(unverifiedQuery);
  } else if (remainingUnverified != null) {
    // Before apply: remaining includes this batch; after preview, still total unverified
    remainingUnverified = Math.max(0, remainingUnverified);
  }

  return NextResponse.json({
    mode: body.mode === 'unverified' ? 'unverified' : 'students',
    count: payload.length,
    applied: body.apply ? updated.length : 0,
    remainingUnverified,
    results: payload,
  });
}
