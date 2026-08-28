import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/requireSession';
import clientPromise from '@/lib/mongodb';
import { nameSim, matchPercent, isPossibleDuplicate, shouldReviewSameDobMatch } from '@/lib/fuzzyName';
import {
  boostMatchPercentForAddress,
  compareStudentAddresses,
  hasComparableAddress,
  type IncomingAddressCheck,
  type StudentAddressRecord,
} from '@/lib/addressDuplicate';
import { LEGACY_ROSTER_COLLECTION, matchLegacyRoster, schoolNameFilter } from '@/lib/legacyRoster';
import { enrichStudentsWithCabinetNames, loadCabinetDrawerLookup } from '@/lib/cabinetNames';
import { logSearchEvent } from '@/lib/searchAnalytics';
import { escapeRegex } from '@/lib/studentSearch';

const STUDENT_PROJECTION = {
  firstName: 1,
  lastName: 1,
  dob: 1,
  labelId: 1,
  studentId: 1,
  school: 1,
  status: 1,
  archived: 1,
  email: 1,
  cabinet: 1,
  drawer: 1,
  drawerSection: 1,
  archiveBoxId: 1,
  archiveBoxLabel: 1,
  archiveLocation: 1,
  archiveSchoolYear: 1,
  address: 1,
  apt: 1,
  city: 1,
  state: 1,
  zip: 1,
  addressStandardized: 1,
  addressGeoclient: 1,
  addressValidationStatus: 1,
};

function annotateMatch(
  student: Record<string, unknown>,
  incoming: { firstName: string; lastName: string; dob: string },
  incomingAddress: IncomingAddressCheck,
  baseSimilarity?: number,
) {
  const address = compareStudentAddresses(
    incomingAddress,
    student as StudentAddressRecord,
  );
  const similarity = baseSimilarity != null
    ? boostMatchPercentForAddress(baseSimilarity, address.match)
    : undefined;

  return {
    ...student,
    _addressMatch: address.match,
    _addressIncoming: address.incomingDisplay,
    _addressExisting: address.existingDisplay,
    _addressExistingVerified: address.existingVerified,
    ...(similarity != null ? { _similarity: similarity } : {}),
  };
}

function isSameAddressMatch(match: string): boolean {
  return match === 'same_verified' || match === 'same' || match === 'similar';
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const { firstName, lastName, dob } = body;
    if (!firstName || !lastName || !dob) {
      return NextResponse.json({ exact: [], fuzzy: [], legacyExact: [], legacyFuzzy: [] });
    }

    const incomingAddress: IncomingAddressCheck = {
      address: body.address,
      apt: body.apt,
      city: body.city,
      state: body.state,
      zip: body.zip,
      standardized: body.standardized ?? null,
      geoclient: body.geoclient ?? null,
    };

    const client = await clientPromise;
    const db = client.db('student-label');

    const scopeQuery: Record<string, unknown> =
      auth.user.role !== 'Admin' && auth.user.school
        ? { school: auth.user.school }
        : {};

    const incoming = { firstName, lastName, dob };
    const exact: Record<string, unknown>[] = [];
    const fuzzy: Record<string, unknown>[] = [];
    const seenIds = new Set<string>();

    const sameDobStudents = await db
      .collection('students')
      .find({ ...scopeQuery, dob })
      .project(STUDENT_PROJECTION)
      .toArray();

    for (const s of sameDobStudents) {
      const id = String(s._id);
      seenIds.add(id);
      const fullIncoming = `${firstName} ${lastName}`.trim().toLowerCase();
      const fullExisting = `${s.firstName} ${s.lastName}`.trim().toLowerCase();

      // Exact name + DOB
      if (fullIncoming === fullExisting) {
        exact.push(annotateMatch(s, incoming, incomingAddress, 100));
        continue;
      }

      const nameDup = isPossibleDuplicate(incoming, s);
      const pct = matchPercent(incoming, s);
      const addressCmp = hasComparableAddress(incomingAddress)
        ? compareStudentAddresses(incomingAddress, s as StudentAddressRecord)
        : null;
      const addressHit = addressCmp ? isSameAddressMatch(addressCmp.match) : false;

      if (!shouldReviewSameDobMatch(incoming, s, {
        sameAddress: addressHit,
        similarityPercent: pct,
      })) {
        continue;
      }

      const boosted = addressHit && addressCmp
        ? boostMatchPercentForAddress(pct, addressCmp.match)
        : pct;
      fuzzy.push({
        ...annotateMatch(s, incoming, incomingAddress, boosted),
        _sameDob: true,
        ...(addressHit ? { _addressDriven: !nameDup } : {}),
        ...(nameDup ? {} : { _sameDobOnly: true }),
      });
    }

    fuzzy.sort((a, b) => Number(b._similarity ?? 0) - Number(a._similarity ?? 0));
    if (fuzzy.length > 15) fuzzy.length = 15;

    const exactNameOtherDob = await db
      .collection('students')
      .find({
        ...scopeQuery,
        firstName: { $regex: new RegExp(`^${escapeRegex(firstName)}$`, 'i') },
        lastName: { $regex: new RegExp(`^${escapeRegex(lastName)}$`, 'i') },
        dob: { $ne: dob },
      })
      .project(STUDENT_PROJECTION)
      .limit(5)
      .toArray();

    for (const s of exactNameOtherDob) {
      const id = String(s._id);
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      const pct = Math.round(
        nameSim(`${firstName} ${lastName}`, `${s.firstName} ${s.lastName}`) * 100,
      );
      fuzzy.push({
        ...annotateMatch(s, incoming, incomingAddress, pct),
        _dobMismatch: true,
      });
    }

    // ASISTS / school legacy roster (read-only export uploaded in school settings)
    let legacyExact: Record<string, unknown>[] = [];
    let legacyFuzzy: Record<string, unknown>[] = [];
    const schoolName =
      auth.user.role === 'Admin' && body.school
        ? String(body.school)
        : auth.user.school || '';
    if (schoolName) {
      const legacyRows = await db
        .collection(LEGACY_ROSTER_COLLECTION)
        .find({
          ...schoolNameFilter(schoolName),
          $or: [
            { dob },
            {
              firstName: { $regex: new RegExp(`^${escapeRegex(firstName)}$`, 'i') },
              lastName: { $regex: new RegExp(`^${escapeRegex(lastName)}$`, 'i') },
            },
          ],
        })
        .limit(40)
        .toArray();
      const matched = matchLegacyRoster(legacyRows, incoming);
      legacyExact = matched.exact;
      legacyFuzzy = matched.fuzzy;
    }

    const { byCabinetId } = await loadCabinetDrawerLookup(db);
    void logSearchEvent({
      query: `${firstName} ${lastName} ${dob}`.trim(),
      resultCount: exact.length + fuzzy.length + legacyExact.length + legacyFuzzy.length,
      source: 'intake-check',
      school: auth.user?.school || null,
      role: auth.user?.role || null,
    });
    return NextResponse.json({
      exact: enrichStudentsWithCabinetNames(exact, byCabinetId),
      fuzzy: enrichStudentsWithCabinetNames(fuzzy, byCabinetId),
      legacyExact,
      legacyFuzzy,
    });
  } catch (error) {
    console.error('Intake check error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
