import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import clientPromise from '@/lib/mongodb';
import {
  LEGACY_ROSTER_COLLECTION,
  schoolConfigNameFilter,
  schoolNameFilter,
  type LegacyRosterMeta,
} from '@/lib/legacyRoster';
import {
  buildLegacyReviewIndexes,
  detectLegacyGarbage,
  findWithinLegacyDuplicates,
  matchLegacyAgainstLive,
  type LegacyReviewRow,
} from '@/lib/legacyRosterReview';

export const runtime = 'nodejs';
export const maxDuration = 60;

function sameSchool(a?: string | null, b?: string | null) {
  return Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());
}

/**
 * GET /api/admin/legacy-roster/review?school=
 *
 * Admin / Data Lead: scan uploaded ASISTS/MDB roster vs live students + garbage flags.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  const userSchool = (session?.user as { school?: string } | undefined)?.school;
  if (!session || !['Admin', 'Data Lead'].includes(role || '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const schoolParam = req.nextUrl.searchParams.get('school')?.trim()
    || (role !== 'Admin' ? userSchool : '')
    || '';

  if (!schoolParam) {
    return NextResponse.json({ error: 'school query required' }, { status: 400 });
  }
  if (role === 'Data Lead' && !sameSchool(userSchool, schoolParam)) {
    return NextResponse.json({ error: 'Forbidden for this school' }, { status: 403 });
  }

  const client = await clientPromise;
  const db = client.db('student-label');

  const config = await db.collection('school_config').findOne(schoolConfigNameFilter(schoolParam));
  const school = (config?.name as string) || schoolParam.trim();
  const meta = (config?.legacyRoster || null) as LegacyRosterMeta | null;

  const [roster, liveStudents] = await Promise.all([
    db.collection(LEGACY_ROSTER_COLLECTION)
      .find(schoolNameFilter(school))
      .project({
        firstName: 1,
        lastName: 1,
        dob: 1,
        externalId: 1,
        sourceFilename: 1,
        sourceTable: 1,
      })
      .toArray(),
    db.collection('students')
      .find({ ...schoolNameFilter(school), archived: { $ne: true } })
      .project({
        firstName: 1,
        lastName: 1,
        dob: 1,
        studentId: 1,
        labelId: 1,
        status: 1,
        externalId: 1,
      })
      .toArray(),
  ]);

  if (roster.length === 0) {
    return NextResponse.json({
      school,
      meta,
      summary: {
        rosterCount: 0,
        liveCount: liveStudents.length,
        garbage: 0,
        exactInSystem: 0,
        fuzzyInSystem: 0,
        idConflicts: 0,
        legacyOnly: 0,
        withinLegacyDupes: 0,
      },
      garbage: [],
      exactMatches: [],
      fuzzyMatches: [],
      idConflicts: [],
      legacyOnlySample: [],
      withinLegacyDupes: [],
      message: meta
        ? 'Roster meta exists but no rows found — re-upload the MDB/CSV from School Settings.'
        : 'No ASISTS/legacy roster uploaded for this school. Upload an MDB or CSV under Admin → Schools.',
    });
  }

  const { byDob, byStudentId } = buildLegacyReviewIndexes(liveStudents as never[]);

  const garbage: LegacyReviewRow[] = [];
  const exactMatches: LegacyReviewRow[] = [];
  const fuzzyMatches: LegacyReviewRow[] = [];
  const idConflicts: LegacyReviewRow[] = [];
  const legacyOnly: LegacyReviewRow[] = [];

  for (const raw of roster) {
    const row = {
      _id: String(raw._id),
      firstName: String(raw.firstName || ''),
      lastName: String(raw.lastName || ''),
      dob: String(raw.dob || ''),
      externalId: raw.externalId ? String(raw.externalId) : undefined,
      sourceFilename: raw.sourceFilename ? String(raw.sourceFilename) : undefined,
      sourceTable: raw.sourceTable ? String(raw.sourceTable) : undefined,
    };
    const flags = detectLegacyGarbage(row);
    const liveMatches = matchLegacyAgainstLive(row, liveStudents as never[], byDob, byStudentId);

    const reviewRow: LegacyReviewRow = {
      ...row,
      garbage: flags,
      liveMatches,
    };

    const hasErrorGarbage = flags.some((f) => f.severity === 'error');
    if (hasErrorGarbage || flags.some((f) => f.severity === 'warning')) {
      garbage.push(reviewRow);
    }

    const hasExact = liveMatches.some((m) => m.matchKind === 'exact_name_dob' || m.matchKind === 'external_id');
    const hasIdConflict = liveMatches.some((m) => m.matchKind === 'id_name_conflict');
    const hasFuzzy = liveMatches.some((m) => m.matchKind === 'fuzzy');

    if (hasIdConflict) idConflicts.push(reviewRow);
    else if (hasExact) exactMatches.push(reviewRow);
    else if (hasFuzzy) fuzzyMatches.push(reviewRow);
    else legacyOnly.push(reviewRow);
  }

  const withinLegacyDupes = findWithinLegacyDuplicates(roster as never[]);

  // Cap payload sizes for the UI
  const cap = <T,>(arr: T[], n = 150) => arr.slice(0, n);

  garbage.sort((a, b) => {
    const ae = a.garbage.filter((g) => g.severity === 'error').length;
    const be = b.garbage.filter((g) => g.severity === 'error').length;
    return be - ae;
  });

  return NextResponse.json({
    school,
    meta,
    summary: {
      rosterCount: roster.length,
      liveCount: liveStudents.length,
      garbage: garbage.length,
      exactInSystem: exactMatches.length,
      fuzzyInSystem: fuzzyMatches.length,
      idConflicts: idConflicts.length,
      legacyOnly: legacyOnly.length,
      withinLegacyDupes: withinLegacyDupes.length,
    },
    garbage: cap(garbage),
    exactMatches: cap(exactMatches),
    fuzzyMatches: cap(fuzzyMatches),
    idConflicts: cap(idConflicts),
    legacyOnlySample: cap(legacyOnly, 50),
    withinLegacyDupes: cap(withinLegacyDupes, 50),
  });
}
