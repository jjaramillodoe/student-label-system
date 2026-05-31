import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import clientPromise from '@/lib/mongodb';
import { nameSim, matchPercent, isPossibleDuplicate } from '@/lib/fuzzyName';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { firstName, lastName, dob } = await request.json();
    if (!firstName || !lastName || !dob) {
      return NextResponse.json({ exact: [], fuzzy: [] });
    }

    const client = await clientPromise;
    const db = client.db('student-label');

    const scopeQuery: Record<string, any> =
      session.user.role !== 'Admin' && session.user.school
        ? { school: session.user.school }
        : {};

    // ── Fast pre-filter: same DOB bucket ──────────────────────────────────────
    const sameDobStudents = await db
      .collection('students')
      .find({ ...scopeQuery, dob })
      .project({ firstName: 1, lastName: 1, dob: 1, labelId: 1, studentId: 1, school: 1, status: 1, email: 1, cabinet: 1 })
      .toArray();

    const incoming = { firstName, lastName, dob };
    const exact: any[] = [];
    const fuzzy: any[] = [];

    for (const s of sameDobStudents) {
      const fullIncoming = `${firstName} ${lastName}`.trim().toLowerCase();
      const fullExisting = `${s.firstName} ${s.lastName}`.trim().toLowerCase();

      if (fullIncoming === fullExisting) {
        // Exact name + exact DOB
        exact.push(s);
      } else if (isPossibleDuplicate(incoming, s)) {
        // Fuzzy / partial-name match — compute display percentage
        const pct = matchPercent(incoming, s);
        fuzzy.push({ ...s, _similarity: pct });
      }
    }

    // ── Also check for exact name match across any DOB (DOB data-entry errors) ─
    const exactNameOtherDob = await db
      .collection('students')
      .find({
        ...scopeQuery,
        firstName: { $regex: new RegExp(`^${firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        lastName: { $regex: new RegExp(`^${lastName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        dob: { $ne: dob },
      })
      .project({ firstName: 1, lastName: 1, dob: 1, labelId: 1, studentId: 1, school: 1, status: 1, email: 1 })
      .limit(5)
      .toArray();

    const nameOnlyMatches = exactNameOtherDob.map(s => ({
      ...s,
      _dobMismatch: true,
      _similarity: Math.round(nameSim(`${firstName} ${lastName}`, `${s.firstName} ${s.lastName}`) * 100),
    }));

    return NextResponse.json({ exact, fuzzy: [...fuzzy, ...nameOnlyMatches] });
  } catch (error) {
    console.error('Intake check error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
