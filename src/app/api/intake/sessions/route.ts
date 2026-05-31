import { NextResponse }    from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions }      from '@/lib/authOptions';
import clientPromise        from '@/lib/mongodb';
import {
  DEFAULT_INTAKE_ACTIVITIES,
  DEFAULT_INTAKE_SESSIONS,
} from '@/lib/intakeDefaults';
import { getCurrentFiscalYear, normalizeFiscalYear } from '@/lib/fiscalYear';

const DEFAULT_SESSIONS = DEFAULT_INTAKE_SESSIONS;

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
      intakeSessions?: string[];
      intakeActivities?: string[];
      currentFiscalYear?: string;
    } | null = null;
    if (userSchool) {
      schoolDoc = await db
        .collection('school_config')
        .findOne({ name: { $regex: `^${userSchool.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }) as {
          intakeSessions?: string[];
          intakeActivities?: string[];
          currentFiscalYear?: string;
        } | null;
    }

    const schoolSessions: string[] =
      Array.isArray(schoolDoc?.intakeSessions) && schoolDoc.intakeSessions.length
        ? schoolDoc.intakeSessions
        : DEFAULT_SESSIONS;

    const schoolActivities: string[] =
      Array.isArray(schoolDoc?.intakeActivities) && schoolDoc.intakeActivities.length
        ? schoolDoc.intakeActivities
        : DEFAULT_INTAKE_ACTIVITIES;

    let sessions = schoolSessions;

    // Intake Members only see sessions assigned to them by an admin.
    if (userRole === 'Intake Member' && userEmail) {
      const userDoc = await db.collection('users').findOne({ email: userEmail });
      const allowed = userDoc?.allowedIntakeSessions;
      if (Array.isArray(allowed) && allowed.length > 0) {
        sessions = schoolSessions.filter(s => allowed.includes(s));
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
    });
  } catch {
    return NextResponse.json({
      sessions: DEFAULT_SESSIONS,
      activities: DEFAULT_INTAKE_ACTIVITIES,
      currentFiscalYear: getCurrentFiscalYear(),
      school: userSchool ?? null,
    });
  }
}
