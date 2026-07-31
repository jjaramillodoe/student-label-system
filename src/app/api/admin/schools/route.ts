import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { authOptions } from '@/lib/authOptions';
import { resolveAgencyId } from '@/lib/studentId';
import { normalizeIntakeStringList } from '@/lib/intakeDefaults';
import { normalizeIntakeSessions } from '@/lib/intakeSession';
import { getCurrentFiscalYear, normalizeFiscalYear } from '@/lib/fiscalYear';
import { DEFAULT_SCHOOLS, getSchoolOptions, isSchoolSlugTaken } from '@/lib/schoolConfig';
import {
  normalizeAssistantPrincipals,
  normalizePrincipal,
} from '@/lib/schoolLeadership';
import { schoolNameToSlug, validateSchoolSlug } from '@/lib/schoolSlug';

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function schoolNameFilter(name: string) {
  return { name: { $regex: `^${escapeRegex(name.trim())}$`, $options: 'i' } };
}

async function upsertDataLeadIntakeSettings(
  db: any,
  userSchool: string,
  intakeSessions: ReturnType<typeof normalizeIntakeSessions>,
  intakeActivities: string[],
  currentFiscalYear: string,
  principal: ReturnType<typeof normalizePrincipal>,
  assistantPrincipals: ReturnType<typeof normalizeAssistantPrincipals>,
) {
  const existing = await db.collection('school_config').findOne(schoolNameFilter(userSchool));
  const now = new Date().toISOString();

  if (existing) {
    const result = await db.collection('school_config').findOneAndUpdate(
      { _id: existing._id },
      {
        $set: {
          intakeSessions,
          intakeActivities,
          currentFiscalYear,
          principal,
          assistantPrincipals,
          updatedAt: now,
        },
      },
      { returnDocument: 'after' },
    );
    return result;
  }

  const defaultTemplate = DEFAULT_SCHOOLS.find(
    (s) => s.name.toLowerCase() === userSchool.toLowerCase(),
  );
  const newSchool = {
    name: userSchool,
    type: defaultTemplate?.type || 'School',
    active: defaultTemplate?.active ?? true,
    agencyId: defaultTemplate?.agencyId || resolveAgencyId(userSchool),
    intakeSessions,
    intakeActivities,
    currentFiscalYear,
    principal,
    assistantPrincipals,
    createdAt: now,
    updatedAt: now,
  };
  const insert = await db.collection('school_config').insertOne(newSchool);
  return { _id: insert.insertedId, ...newSchool };
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || !['Admin', 'Data Lead'].includes((session.user as any)?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const client = await clientPromise;
    const db = client.db('student-label');
    let schools = await getSchoolOptions(db);

    const role = (session.user as { role?: string })?.role;
    const userSchool = (session.user as { school?: string })?.school?.trim();
    if (role === 'Data Lead' && userSchool) {
      schools = schools.filter(
        (school: { name?: string }) => school.name?.toLowerCase() === userSchool.toLowerCase(),
      );
    }

    return NextResponse.json(schools);
  } catch (error) {
    console.error('Error fetching schools:', error);
    return NextResponse.json({ error: 'Failed to fetch schools' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || (session.user as any)?.role !== 'Admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const {
      name,
      type = 'School',
      active = true,
      agencyId,
      slug: rawSlug,
      intakeSessions,
      intakeActivities,
      currentFiscalYear,
      principal,
      assistantPrincipals,
    } = await req.json();
    const trimmedName = typeof name === 'string' ? name.trim() : '';

    if (!trimmedName) {
      return NextResponse.json({ error: 'School/program name is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('student-label');
    const existing = await db.collection('school_config').findOne({
      name: { $regex: `^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
    });

    if (existing) {
      return NextResponse.json({ error: 'School/program already exists' }, { status: 409 });
    }

    const slugInput =
      typeof rawSlug === 'string' && rawSlug.trim()
        ? rawSlug
        : schoolNameToSlug(trimmedName);
    const slugCheck = validateSchoolSlug(slugInput);
    if (!slugCheck.ok) {
      return NextResponse.json({ error: slugCheck.error }, { status: 400 });
    }
    if (await isSchoolSlugTaken(slugCheck.slug)) {
      return NextResponse.json(
        { error: `Subdomain "${slugCheck.slug}" is already used by another school` },
        { status: 409 },
      );
    }

    const resolvedAgencyId = (typeof agencyId === 'string' && agencyId.trim())
      ? agencyId.trim().toUpperCase()
      : resolveAgencyId(trimmedName);

    const now = new Date().toISOString();
    const school = {
      name: trimmedName,
      type,
      active: Boolean(active),
      agencyId: resolvedAgencyId,
      slug: slugCheck.slug,
      intakeSessions: normalizeIntakeSessions(intakeSessions).filter((s) => s.name.trim()),
      intakeActivities: normalizeIntakeStringList(intakeActivities),
      currentFiscalYear: normalizeFiscalYear(currentFiscalYear),
      principal: normalizePrincipal(principal),
      assistantPrincipals: normalizeAssistantPrincipals(assistantPrincipals),
      createdAt: now,
      updatedAt: now,
    };
    const result = await db.collection('school_config').insertOne(school);

    return NextResponse.json({ _id: result.insertedId, ...school }, { status: 201 });
  } catch (error) {
    console.error('Error creating school:', error);
    return NextResponse.json({ error: 'Failed to create school/program' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;

  if (!session || !['Admin', 'Data Lead'].includes(role || '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const client = await clientPromise;
    const db = client.db('student-label');

    if (role === 'Data Lead') {
      const userSchool = (session.user as { school?: string })?.school?.trim();
      if (!userSchool) {
        return NextResponse.json({ error: 'No school assigned to this account' }, { status: 403 });
      }

      const intakeSessions = normalizeIntakeSessions(body.intakeSessions).filter((s) => s.name.trim());
      const intakeActivities = normalizeIntakeStringList(body.intakeActivities);
      const currentFiscalYear = normalizeFiscalYear(body.currentFiscalYear);
      const principal = normalizePrincipal(body.principal);
      const assistantPrincipals = normalizeAssistantPrincipals(body.assistantPrincipals);
      const result = await upsertDataLeadIntakeSettings(
        db,
        userSchool,
        intakeSessions,
        intakeActivities,
        currentFiscalYear,
        principal,
        assistantPrincipals,
      );

      if (!result) {
        return NextResponse.json({ error: 'School/program not found' }, { status: 404 });
      }

      return NextResponse.json(result);
    }

    const {
      _id,
      name,
      type,
      active,
      agencyId,
      slug: rawSlug,
      intakeSessions,
      intakeActivities,
      currentFiscalYear,
      principal,
      assistantPrincipals,
    } = body;
    const trimmedName = typeof name === 'string' ? name.trim() : '';

    if (!_id || !ObjectId.isValid(_id)) {
      return NextResponse.json({ error: 'Valid school/program ID is required' }, { status: 400 });
    }

    if (!trimmedName) {
      return NextResponse.json({ error: 'School/program name is required' }, { status: 400 });
    }

    const slugInput =
      typeof rawSlug === 'string' && rawSlug.trim()
        ? rawSlug
        : schoolNameToSlug(trimmedName);
    const slugCheck = validateSchoolSlug(slugInput);
    if (!slugCheck.ok) {
      return NextResponse.json({ error: slugCheck.error }, { status: 400 });
    }
    if (await isSchoolSlugTaken(slugCheck.slug, _id)) {
      return NextResponse.json(
        { error: `Subdomain "${slugCheck.slug}" is already used by another school` },
        { status: 409 },
      );
    }

    const resolvedAgencyId = (typeof agencyId === 'string' && agencyId.trim())
      ? agencyId.trim().toUpperCase()
      : resolveAgencyId(trimmedName);

    const result = await db.collection('school_config').findOneAndUpdate(
      { _id: new ObjectId(_id) },
      {
        $set: {
          name: trimmedName,
          type: type || 'School',
          active: Boolean(active),
          agencyId: resolvedAgencyId,
          slug: slugCheck.slug,
          intakeSessions: normalizeIntakeSessions(intakeSessions).filter((s) => s.name.trim()),
          intakeActivities: normalizeIntakeStringList(intakeActivities),
          currentFiscalYear: normalizeFiscalYear(currentFiscalYear),
          principal: normalizePrincipal(principal),
          assistantPrincipals: normalizeAssistantPrincipals(assistantPrincipals),
          updatedAt: new Date().toISOString(),
        },
      },
      { returnDocument: 'after' }
    );

    if (!result) {
      return NextResponse.json({ error: 'School/program not found' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating school:', error);
    return NextResponse.json({ error: 'Failed to update school/program' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || (session.user as any)?.role !== 'Admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Valid school/program ID is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('student-label');
    const result = await db.collection('school_config').deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'School/program not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting school:', error);
    return NextResponse.json({ error: 'Failed to delete school/program' }, { status: 500 });
  }
}
