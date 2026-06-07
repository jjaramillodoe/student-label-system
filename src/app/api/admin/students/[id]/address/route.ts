import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import {
  normalizeStudentAddress,
  validateStudentAddress,
} from '@/lib/addressValidation';
import { verifyAddressWithGeoclient } from '@/lib/addressGeoclient';

const ADDRESS_ROLES = ['Admin', 'Data Lead', 'Data Member'];

function isValidObjectId(id: string) {
  try {
    new ObjectId(id);
    return true;
  } catch {
    return false;
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userSchool = (session?.user as { school?: string })?.school;

  if (!session || !ADDRESS_ROLES.includes(role || '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: 'Invalid student ID' }, { status: 400 });
  }

  const body = await req.json() as {
    address?: string;
    apt?: string;
    city?: string;
    state?: string;
    zip?: string;
    verifyAfterSave?: boolean;
  };

  const normalized = normalizeStudentAddress({
    address: body.address,
    apt: body.apt,
    city: body.city,
    state: body.state,
    zip: body.zip,
  });

  const local = validateStudentAddress(normalized);
  const now = new Date().toISOString();

  const client = await clientPromise;
  const db = client.db('student-label');

  const query: Record<string, unknown> = { _id: new ObjectId(id) };
  if (role !== 'Admin' && userSchool) {
    query.school = userSchool;
  }

  const existing = await db.collection('students').findOne(query);
  if (!existing) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 });
  }

  const setFields: Record<string, unknown> = {
    address: normalized.address || null,
    apt: normalized.apt || null,
    city: normalized.city || null,
    state: normalized.state || null,
    zip: normalized.zip || null,
    addressFlags: local.flags,
    addressWarnings: local.warnings,
    updatedAt: now,
  };

  const unsetFields: Record<string, string> = {
    addressGeoclient: '',
    addressVerifiedAt: '',
    addressStandardized: '',
  };

  if (local.status === 'empty') {
    setFields.addressValidationStatus = 'empty';
  } else if (body.verifyAfterSave) {
    const verification = await verifyAddressWithGeoclient(normalized);
    setFields.addressValidationStatus = verification.status;
    setFields.addressFlags = verification.flags;
    setFields.addressWarnings = verification.warnings;
    setFields.addressGeoclient = verification.geoclient;
    setFields.addressVerifiedAt = now;

    if (verification.standardized && ['verified', 'warning'].includes(verification.status)) {
      setFields.address = verification.standardized.address || null;
      setFields.apt = verification.standardized.apt || null;
      setFields.city = verification.standardized.city || null;
      setFields.state = verification.standardized.state || null;
      setFields.zip = verification.standardized.zip || null;
      setFields.addressStandardized = verification.standardized;
    }

    delete unsetFields.addressGeoclient;
    delete unsetFields.addressVerifiedAt;
    if (setFields.addressStandardized) {
      delete unsetFields.addressStandardized;
    }
  } else {
    setFields.addressValidationStatus = 'unverified';
  }

  const result = await db.collection('students').findOneAndUpdate(
    query,
    {
      $set: setFields,
      $unset: unsetFields,
    },
    { returnDocument: 'after' },
  );

  if (!result) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 });
  }

  return NextResponse.json({
    student: {
      ...result,
      _id: result._id.toString(),
    },
    verified: Boolean(body.verifyAfterSave),
  });
}
