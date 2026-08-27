import { NextResponse }    from 'next/server';
import { requireSession } from '@/lib/requireSession';
import clientPromise        from '@/lib/mongodb';
import {
  DEFAULT_INTAKE_ACTIVITIES,
  DEFAULT_INTAKE_SESSION_CONFIGS,
} from '@/lib/intakeDefaults';
import { getCurrentFiscalYear, normalizeFiscalYear } from '@/lib/fiscalYear';
import { escapeRegex } from '@/lib/studentSearch';
import {
  intakeSessionNames,
  normalizeIntakeSessions,
  type IntakeSession,
} from '@/lib/intakeSession';

export async function GET() {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const userEmail = auth.user?.email;
  const userRole = auth.user?.role;
  const userSchool = auth.user?.school;

  try {
    const client = await clientPromise;
    const db     = client.db('student-label');

    let schoolDoc: {
      intakeSessions?: unknown;
      intakeActivities?: string[];
      currentFiscalYear?: string;
    } | null = null;
    if (userSchool) {
      schoolDoc = await db
        .collection('school_config')
        .findOne({ name: { $regex: `^${escapeRegex(userSchool)}$`, $options: 'i' } }) as {
          intakeSessions?: unknown;
          intakeActivities?: string[];
          currentFiscalYear?: string;
        } | null;
    }

    const schoolSessions: IntakeSession[] =
      normalizeIntakeSessions(schoolDoc?.intakeSessions).length
        ? normalizeIntakeSessions(schoolDoc?.intakeSessions)
        : DEFAULT_INTAKE_SESSION_CONFIGS;

    const schoolActivities: string[] =
      Array.isArray(schoolDoc?.intakeActivities) && schoolDoc.intakeActivities.length
        ? schoolDoc.intakeActivities
        : DEFAULT_INTAKE_ACTIVITIES;

    let sessions = schoolSessions;

    if (userRole === 'Intake Member' && userEmail) {
      const userDoc = await db.collection('users').findOne({ email: userEmail });
      const allowed = userDoc?.allowedIntakeSessions;
      if (Array.isArray(allowed) && allowed.length > 0) {
        sessions = schoolSessions.filter((s) => allowed.includes(s.name));
      }
    }

    const currentFiscalYear = normalizeFiscalYear(
      schoolDoc?.currentFiscalYear,
      getCurrentFiscalYear(),
    );

    return NextResponse.json({
      sessions,
      activities: schoolActivities,
      currentFiscalYear,
      school: userSchool ?? null,
      allSessions: schoolSessions,
      allActivities: schoolActivities,
      // Backward-compatible name list for older clients
      sessionNames: intakeSessionNames(sessions),
      allSessionNames: intakeSessionNames(schoolSessions),
    });
  } catch {
    return NextResponse.json({
      sessions: DEFAULT_INTAKE_SESSION_CONFIGS,
      activities: DEFAULT_INTAKE_ACTIVITIES,
      currentFiscalYear: getCurrentFiscalYear(),
      school: userSchool ?? null,
      sessionNames: intakeSessionNames(DEFAULT_INTAKE_SESSION_CONFIGS),
    });
  }
}
