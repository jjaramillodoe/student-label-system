import { NextResponse }    from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions }      from '@/lib/authOptions';
import clientPromise        from '@/lib/mongodb';
import {
  DEFAULT_INTAKE_ACTIVITIES,
  DEFAULT_INTAKE_SESSION_CONFIGS,
} from '@/lib/intakeDefaults';
import { getCurrentFiscalYear, normalizeFiscalYear } from '@/lib/fiscalYear';
import {
  intakeSessionNames,
  normalizeIntakeSessions,
  type IntakeSession,
} from '@/lib/intakeSession';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userEmail = session.user?.email;
  const userRole = (session.user as { role?: string })?.role;
  const userSchool = (session.user as { school?: string })?.school;

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
        .findOne({ name: { $regex: `^${userSchool.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }) as {
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
