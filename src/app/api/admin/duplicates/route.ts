import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { ObjectId } from 'mongodb';
import { isPossibleDuplicate } from '@/lib/fuzzyName';
import {
  addressMatchHint,
  addressMatchLabel,
  comparePeerAddresses,
  isSameAddressPair,
  type StudentAddressRecord,
} from '@/lib/addressDuplicate';

/**
 * GET /api/admin/duplicates
 *
 * Returns two groups:
 *   flagged      — students with siblingFlag:true + their fuzzy matches
 *   autoDetected — pairs found by scanning all students for same-DOB name similarity
 *                  (excludes already-confirmed siblings and already-flagged records)
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  const school = (session?.user as any)?.school;
  if (!session || !['Admin', 'Data Lead'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const client = await clientPromise;
  const db = client.db('student-label');

  const schoolFilter: Record<string, any> = role !== 'Admin' ? { school } : {};
  const allStudents: any[] = await db.collection('students')
    .find({ ...schoolFilter, archived: { $ne: true } })
    .toArray();

  // Index by DOB for O(k) candidate lookup
  const byDob = new Map<string, any[]>();
  for (const s of allStudents) {
    if (!s.dob) continue;
    const arr = byDob.get(s.dob) || [];
    arr.push(s);
    byDob.set(s.dob, arr);
  }

  const serialize = (s: any) => ({ ...s, _id: s._id.toString() });

  function addressComparisonFor(a: any, b: any) {
    const cmp = comparePeerAddresses(a as StudentAddressRecord, b as StudentAddressRecord);
    const flaggedVerified = ['verified', 'warning'].includes(
      String(a.addressValidationStatus ?? ''),
    );
    const matchVerified = ['verified', 'warning'].includes(
      String(b.addressValidationStatus ?? ''),
    );
    return {
      match: cmp.match,
      flaggedDisplay: cmp.incomingDisplay,
      matchDisplay: cmp.existingDisplay,
      flaggedVerified,
      matchVerified,
      label: addressMatchLabel(cmp.match),
      hint: addressMatchHint(cmp.match),
      addressDriven: isSameAddressPair(a, b) && !isPossibleDuplicate(a, b),
    };
  }

  function enrichMatch(flagged: any, match: any) {
    return {
      ...serialize(match),
      addressComparison: addressComparisonFor(flagged, match),
    };
  }

  function isPairCandidate(a: any, b: any): boolean {
    return isPossibleDuplicate(a, b) || isSameAddressPair(a, b);
  }

  // ── Flagged pairs (explicit siblingFlag) ──────────────────────────────────
  const flaggedStudents = allStudents.filter(s => s.siblingFlag === true);
  const flaggedPairs = flaggedStudents.map(f => {
    const candidates = (byDob.get(f.dob) || [])
      .filter(c => c._id.toString() !== f._id.toString())
      .filter(c => isPairCandidate(f, c));
    return {
      flagged: serialize(f),
      matches: candidates.map(c => enrichMatch(f, c)),
    };
  });

  // ── Auto-detected pairs (same DOB + fuzzy name, not yet confirmed/flagged) ─
  // Track pairs we've already emitted to avoid A-B and B-A duplicates
  const seen = new Set<string>();
  const autoPairs: Array<{ flagged: any; matches: any[] }> = [];

  for (const [, group] of byDob) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];

        // Skip already confirmed siblings
        if (a.siblingConfirmed || b.siblingConfirmed) continue;
        // Skip if either is already flagged (already in flaggedPairs)
        if (a.siblingFlag || b.siblingFlag) continue;
        // Skip if either has dismissed the other
        const aId = a._id.toString();
        const bId = b._id.toString();
        if (Array.isArray(a.siblingDismissed) && a.siblingDismissed.includes(bId)) continue;
        if (Array.isArray(b.siblingDismissed) && b.siblingDismissed.includes(aId)) continue;

        if (!isPairCandidate(a, b)) continue;

        const pairKey = [a._id.toString(), b._id.toString()].sort().join(':');
        if (seen.has(pairKey)) continue;
        seen.add(pairKey);

        autoPairs.push({
          flagged: serialize(a),
          matches: [enrichMatch(a, b)],
        });
      }
    }
  }

  return NextResponse.json({ flagged: flaggedPairs, autoDetected: autoPairs });
}

/**
 * POST /api/admin/duplicates
 * Body: { action, primaryId, secondaryId?, secondary?, filledFields? }
 *
 * action = 'merge'            — keep primaryId, delete secondaryId, decrement its drawer count
 * action = 'undo_merge'       — restore deleted secondary + revert filled fields on primary
 * action = 'confirm_siblings' — both are real siblings; clear siblingFlag on both
 * action = 'dismiss'          — not a duplicate; clear siblingFlag on primaryId only
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  const school = (session?.user as any)?.school;
  if (!session || !['Admin', 'Data Lead'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { action, primaryId, secondaryId, secondary, filledFields } = body;
  if (!action || !primaryId) {
    return NextResponse.json({ error: 'action and primaryId required' }, { status: 400 });
  }

  const client = await clientPromise;
  const db = client.db('student-label');

  const primaryOid = new ObjectId(primaryId);
  const primary = await db.collection('students').findOne({ _id: primaryOid });
  if (!primary) return NextResponse.json({ error: 'Primary student not found' }, { status: 404 });
  if (role !== 'Admin' && primary.school !== school) {
    return NextResponse.json({ error: 'Forbidden for this school' }, { status: 403 });
  }

  // ── UNDO MERGE ───────────────────────────────────────────────────────────────
  if (action === 'undo_merge') {
    if (!secondary || !secondary._id) {
      return NextResponse.json({ error: 'secondary snapshot required' }, { status: 400 });
    }
    const secondaryOid = new ObjectId(String(secondary._id));
    if (role !== 'Admin' && secondary.school && secondary.school !== school) {
      return NextResponse.json({ error: 'Forbidden for this school' }, { status: 403 });
    }

    const existing = await db.collection('students').findOne({ _id: secondaryOid });
    if (existing) {
      return NextResponse.json({ error: 'Secondary student already exists' }, { status: 409 });
    }

    const { _id: _ignored, ...rest } = secondary as Record<string, unknown>;
    await db.collection('students').insertOne({ ...rest, _id: secondaryOid });

    if (secondary.cabinet && secondary.drawer) {
      try {
        const cabinetOid = new ObjectId(String(secondary.cabinet));
        await db.collection('cabinets').updateOne(
          { _id: cabinetOid, 'drawers._id': secondary.drawer },
          { $inc: { currentCount: 1, 'drawers.$.currentCount': 1 } },
        );
      } catch { /* cabinet may not exist — continue */ }
    }

    const fieldsToUnset: Record<string, ''> = { mergedFromId: '' };
    const fieldList: string[] = Array.isArray(filledFields) ? filledFields : [];
    for (const field of fieldList) {
      if (typeof field !== 'string' || !field) continue;
      // Only clear if primary still has the value we copied from secondary
      if (primary[field] === secondary[field]) {
        fieldsToUnset[field] = '';
      }
    }
    await db.collection('students').updateOne(
      { _id: primaryOid },
      { $unset: fieldsToUnset },
    );

    return NextResponse.json({ success: true, action: 'undo_merge', restoredId: String(secondaryOid) });
  }

  // ── DISMISS ──────────────────────────────────────────────────────────────────
  // For dismiss we mark BOTH records as dismissed so auto-detection won't
  // resurface the pair. secondaryId is optional (flagged-only dismiss).
  if (action === 'dismiss') {
    const now = new Date().toISOString();
    const dismissedWith = secondaryId ? [secondaryId] : [];
    await db.collection('students').updateOne(
      { _id: primaryOid },
      { $set: { siblingFlag: false, siblingReviewedAt: now }, $addToSet: { siblingDismissed: { $each: dismissedWith } } }
    );
    if (secondaryId) {
      const secondaryOid = new ObjectId(secondaryId);
      await db.collection('students').updateOne(
        { _id: secondaryOid },
        { $set: { siblingFlag: false, siblingReviewedAt: now }, $addToSet: { siblingDismissed: primaryId } }
      );
    }
    return NextResponse.json({ success: true, action: 'dismiss' });
  }

  // ── CONFIRM SIBLINGS ─────────────────────────────────────────────────────────
  if (action === 'confirm_siblings') {
    if (!secondaryId) return NextResponse.json({ error: 'secondaryId required' }, { status: 400 });
    const secondaryOid = new ObjectId(secondaryId);
    const now = new Date().toISOString();

    // Link both records to each other bidirectionally
    await db.collection('students').updateOne(
      { _id: primaryOid },
      {
        $set: { siblingFlag: false, siblingConfirmed: true, siblingReviewedAt: now },
        $addToSet: { siblingWith: secondaryId },
      }
    );
    await db.collection('students').updateOne(
      { _id: secondaryOid },
      {
        $set: { siblingFlag: false, siblingConfirmed: true, siblingReviewedAt: now },
        $addToSet: { siblingWith: primaryId },
      }
    );
    return NextResponse.json({ success: true, action: 'confirm_siblings' });
  }

  // ── MERGE ────────────────────────────────────────────────────────────────────
  if (action === 'merge') {
    if (!secondaryId) return NextResponse.json({ error: 'secondaryId required' }, { status: 400 });
    const secondaryOid = new ObjectId(secondaryId);
    const secondaryDoc = await db.collection('students').findOne({ _id: secondaryOid });
    if (!secondaryDoc) return NextResponse.json({ error: 'Secondary student not found' }, { status: 404 });
    if (role !== 'Admin' && secondaryDoc.school !== school) {
      return NextResponse.json({ error: 'Forbidden for this school' }, { status: 403 });
    }

    // Merge: fill any missing fields on primary from secondary
    const mergedFields: Record<string, any> = {
      siblingFlag: false,
      siblingConfirmed: false,
      siblingReviewedAt: new Date().toISOString(),
      mergedFromId: secondaryId,
    };
    const fillIfMissing = [
      'email', 'phone', 'gender', 'program', 'notes', 'fiscalYear', 'startDate',
      'address', 'apt', 'city', 'state', 'zip',
    ];
    const filledFromSecondary: string[] = [];
    for (const field of fillIfMissing) {
      if (!primary[field] && secondaryDoc[field]) {
        mergedFields[field] = secondaryDoc[field];
        filledFromSecondary.push(field);
      }
    }

    await db.collection('students').updateOne({ _id: primaryOid }, { $set: mergedFields });

    // Decrement the secondary's drawer/cabinet count before deleting
    if (secondaryDoc.cabinet && secondaryDoc.drawer) {
      try {
        const cabinetOid = new ObjectId(secondaryDoc.cabinet);
        await db.collection('cabinets').updateOne(
          { _id: cabinetOid, 'drawers._id': secondaryDoc.drawer },
          { $inc: { currentCount: -1, 'drawers.$.currentCount': -1 } }
        );
      } catch { /* cabinet may not exist — continue */ }
    }

    await db.collection('students').deleteOne({ _id: secondaryOid });

    const secondarySnapshot = { ...secondaryDoc, _id: secondaryId };

    return NextResponse.json({
      success: true,
      action: 'merge',
      deletedId: secondaryId,
      undo: {
        primaryId,
        secondary: secondarySnapshot,
        filledFields: filledFromSecondary,
      },
    });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
