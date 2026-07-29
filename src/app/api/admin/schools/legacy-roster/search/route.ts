import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import clientPromise from '@/lib/mongodb';
import { isStudentSearchQueryValid, buildStudentSearchOrConditions } from '@/lib/studentSearch';
import { LEGACY_ROSTER_COLLECTION, schoolNameFilter } from '@/lib/legacyRoster';

/** GET ?q=&school= — search legacy/ASISTS roster for intake */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const role = session.user?.role;
    if (!['Admin', 'Data Lead', 'Data Member', 'Intake Member'].includes(role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const q = req.nextUrl.searchParams.get('q')?.trim() || '';
    const schoolParam = req.nextUrl.searchParams.get('school')?.trim() || '';
    const school = role === 'Admin' && schoolParam
      ? schoolParam
      : session.user?.school || schoolParam;

    if (!school) {
      return NextResponse.json({ results: [], school: null });
    }
    if (!isStudentSearchQueryValid(q)) {
      return NextResponse.json({ results: [], school });
    }

    const orConditions = buildStudentSearchOrConditions(q);
    if (!orConditions.length) {
      return NextResponse.json({ results: [], school });
    }

    const client = await clientPromise;
    const db = client.db('student-label');
    const results = await db
      .collection(LEGACY_ROSTER_COLLECTION)
      .find({ ...schoolNameFilter(school), $or: orConditions })
      .project({
        firstName: 1,
        lastName: 1,
        dob: 1,
        externalId: 1,
        sourceFilename: 1,
        sourceTable: 1,
        importedAt: 1,
      })
      .limit(15)
      .toArray();

    return NextResponse.json({
      school,
      results: results.map(r => ({
        ...r,
        _id: String(r._id),
        _legacy: true,
        status: 'ASISTS / Legacy',
        labelId: r.externalId || undefined,
      })),
    });
  } catch (error) {
    console.error('legacy-roster search', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
