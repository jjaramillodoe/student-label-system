import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import clientPromise from '@/lib/mongodb';
import { authOptions } from '@/lib/authOptions';
import { resolveAgencyId } from '@/lib/studentId';
import { normalizeIntakeStringList } from '@/lib/intakeDefaults';
import { normalizeIntakeSessions } from '@/lib/intakeSession';
import { getCurrentFiscalYear, normalizeFiscalYear } from '@/lib/fiscalYear';
import { DEFAULT_SCHOOLS, isSchoolSlugTaken } from '@/lib/schoolConfig';
import {
  normalizeAssistantPrincipals,
  normalizePrincipal,
} from '@/lib/schoolLeadership';
import { schoolNameToSlug, validateSchoolSlug } from '@/lib/schoolSlug';
import { parsePrincipalsCsv, type PrincipalsCsvSchoolRow } from '@/lib/principalsCsv';

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function schoolNameFilter(name: string) {
  return { name: { $regex: `^${escapeRegex(name.trim())}$`, $options: 'i' } };
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role?: string })?.role !== 'Admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const csvText = typeof body.csv === 'string' ? body.csv : '';
    const templateSchoolName =
      typeof body.templateSchool === 'string' && body.templateSchool.trim()
        ? body.templateSchool.trim()
        : 'School 8';
    const copyIntake = body.copyIntake !== false;

    let rows: PrincipalsCsvSchoolRow[] = [];
    if (csvText) {
      rows = parsePrincipalsCsv(csvText);
    } else if (Array.isArray(body.schools)) {
      rows = body.schools as PrincipalsCsvSchoolRow[];
    }

    if (!rows.length) {
      return NextResponse.json(
        { error: 'No school rows found in CSV. Expected columns: School, Principal Name, Email Address, AP Name 1, …' },
        { status: 400 },
      );
    }

    const client = await clientPromise;
    const db = client.db('student-label');

    const template = await db.collection('school_config').findOne(schoolNameFilter(templateSchoolName));
    if (copyIntake && !template) {
      return NextResponse.json(
        {
          error: `${templateSchoolName} is not saved in school settings yet. Open ${templateSchoolName}, save intake sessions/activities once, then re-import.`,
        },
        { status: 400 },
      );
    }

    const templateSessions = normalizeIntakeSessions(template?.intakeSessions).filter((s) => s.name.trim());
    const templateActivities = normalizeIntakeStringList(template?.intakeActivities);
    const templateFy = normalizeFiscalYear(
      template?.currentFiscalYear || getCurrentFiscalYear(),
    );

    const updated: string[] = [];
    const created: string[] = [];
    const errors: Array<{ school: string; reason: string }> = [];

    for (const row of rows) {
      const schoolName = row.school.trim();
      try {
        const principal = normalizePrincipal(row.principal);
        const assistantPrincipals = normalizeAssistantPrincipals(row.assistantPrincipals);
        const now = new Date().toISOString();
        const existing = await db.collection('school_config').findOne(schoolNameFilter(schoolName));

        if (existing) {
          const $set: Record<string, unknown> = {
            principal,
            assistantPrincipals,
            updatedAt: now,
          };
          if (copyIntake) {
            $set.intakeSessions = templateSessions;
            $set.intakeActivities = templateActivities;
            if (!existing.currentFiscalYear) $set.currentFiscalYear = templateFy;
          }
          await db.collection('school_config').updateOne({ _id: existing._id }, { $set });
          updated.push(schoolName);
          continue;
        }

        const defaultTemplate = DEFAULT_SCHOOLS.find(
          (s) => s.name.toLowerCase() === schoolName.toLowerCase(),
        );
        const slugCheck = validateSchoolSlug(
          defaultTemplate?.slug || schoolNameToSlug(schoolName),
        );
        if (!slugCheck.ok) {
          errors.push({ school: schoolName, reason: slugCheck.error });
          continue;
        }
        if (await isSchoolSlugTaken(slugCheck.slug)) {
          errors.push({
            school: schoolName,
            reason: `Subdomain "${slugCheck.slug}" already in use`,
          });
          continue;
        }

        await db.collection('school_config').insertOne({
          name: defaultTemplate?.name || schoolName,
          type: defaultTemplate?.type || 'School',
          active: defaultTemplate?.active ?? true,
          agencyId: defaultTemplate?.agencyId || resolveAgencyId(schoolName),
          slug: slugCheck.slug,
          principal,
          assistantPrincipals,
          intakeSessions: copyIntake ? templateSessions : [],
          intakeActivities: copyIntake ? templateActivities : [],
          currentFiscalYear: templateFy,
          createdAt: now,
          updatedAt: now,
        });
        created.push(schoolName);
      } catch (err) {
        errors.push({
          school: schoolName,
          reason: err instanceof Error ? err.message : 'Update failed',
        });
      }
    }

    return NextResponse.json({
      templateSchool: templateSchoolName,
      copyIntake,
      intakeSessionsCopied: copyIntake ? templateSessions.length : 0,
      intakeActivitiesCopied: copyIntake ? templateActivities.length : 0,
      updated,
      created,
      errors,
      summary: {
        updated: updated.length,
        created: created.length,
        errors: errors.length,
      },
    });
  } catch (err) {
    console.error('[import-principals]', err);
    return NextResponse.json({ error: 'Failed to import principals' }, { status: 500 });
  }
}
