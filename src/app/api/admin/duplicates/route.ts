import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrDataLead } from '@/lib/requireSession';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { isPossibleDuplicate } from '@/lib/fuzzyName';
import {
  addressMatchHint,
  addressMatchLabel,
  comparePeerAddresses,
  isSameAddressPair,
  type StudentAddressRecord,
} from '@/lib/addressDuplicate';
import {
  applyFillIfMissing,
  applyMergeFieldChoices,
  canTransferDrawer,
  isValidMergeChoices,
  LOCATION_TRANSFER_FIELDS,
  type AppliedFieldChange,
} from '@/lib/mergeFields';
import { findCapped, scanMeta } from '@/lib/adminScan';
import { withMongoTransaction } from '@/lib/mongoTransaction';

export const MERGE_HISTORY_COLLECTION = 'merge_history';
/** How long Undo remains available from history (ms). */
export const MERGE_HISTORY_UNDO_MS = 15 * 60 * 1000;

/**
 * GET /api/admin/duplicates
 *
 * Returns two groups:
 *   flagged      — students with siblingFlag:true + their fuzzy matches
 *   autoDetected — pairs found by scanning all students for same-DOB name similarity
 *                  (excludes already-confirmed siblings and already-flagged records)
 *   recentMerges — durable merge history (undoable within MERGE_HISTORY_UNDO_MS)
 */
export async function GET() {
  const auth = await requireAdminOrDataLead();
  if (!auth.ok) return auth.response;
  const role = auth.user.role;
  const school = auth.user.school;

  const client = await clientPromise;
  const db = client.db('student-label');

  const schoolFilter: Record<string, any> = role !== 'Admin' ? { school } : {};
  const scanned = await findCapped(db.collection('students'), {
    ...schoolFilter,
    archived: { $ne: true },
  });
  const allStudents: any[] = scanned.docs;

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

  const historyFilter: Record<string, unknown> = { undoneAt: { $exists: false } };
  if (role !== 'Admin') historyFilter.school = school;
  const recentMergeDocs = await db.collection(MERGE_HISTORY_COLLECTION)
    .find(historyFilter)
    .sort({ at: -1 })
    .limit(20)
    .toArray();
  const nowMs = Date.now();
  const recentMerges = recentMergeDocs.map((h) => {
    const atMs = new Date(String(h.at)).getTime();
    const undoRemainingMs = Math.max(0, MERGE_HISTORY_UNDO_MS - (nowMs - atMs));
    return {
      _id: String(h._id),
      at: h.at,
      byEmail: h.byEmail || '',
      byName: h.byName || '',
      school: h.school || '',
      primaryId: h.primaryId,
      primaryName: h.primaryName || '',
      secondaryId: h.secondaryId,
      secondaryName: h.secondaryName || '',
      fieldCount: Array.isArray(h.changes) ? h.changes.length : 0,
      drawerTransferred: Boolean(h.drawerTransferred),
      canUndo: undoRemainingMs > 0,
      undoRemainingMs,
    };
  });

  return NextResponse.json({
    ...scanMeta(scanned),
    flagged: flaggedPairs,
    autoDetected: autoPairs,
    recentMerges,
    mergeUndoWindowMs: MERGE_HISTORY_UNDO_MS,
  });
}

/**
 * POST /api/admin/duplicates
 * Body: {
 *   action, primaryId, secondaryId?,
 *   fieldChoices?, transferDrawer?,
 *   secondary?, changes?, historyId?, drawerTransferred?,
 *   pairs?,  // bulk_confirm_siblings | bulk_dismiss
 * }
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdminOrDataLead();
  if (!auth.ok) return auth.response;
  const role = auth.user.role;
  const school = auth.user.school;

  const body = await req.json();
  const {
    action, primaryId, secondaryId, secondary, filledFields, fieldChoices, changes,
    transferDrawer, drawerTransferred, historyId, pairs,
  } = body;
  if (!action) {
    return NextResponse.json({ error: 'action required' }, { status: 400 });
  }

  const client = await clientPromise;
  const db = client.db('student-label');

  // ── BULK CONFIRM / DISMISS (same-building helpers) ─────────────────────────
  if (action === 'bulk_confirm_siblings' || action === 'bulk_dismiss') {
    if (!Array.isArray(pairs) || pairs.length === 0) {
      return NextResponse.json({ error: 'pairs array required' }, { status: 400 });
    }
    if (pairs.length > 50) {
      return NextResponse.json({ error: 'Max 50 pairs per bulk action' }, { status: 400 });
    }
    const now = new Date().toISOString();
    let processed = 0;
    for (const pair of pairs) {
      const aId = String(pair?.primaryId || '');
      const bId = String(pair?.secondaryId || '');
      if (!ObjectId.isValid(aId) || !ObjectId.isValid(bId)) continue;
      const aOid = new ObjectId(aId);
      const bOid = new ObjectId(bId);
      const aDoc = await db.collection('students').findOne({ _id: aOid });
      const bDoc = await db.collection('students').findOne({ _id: bOid });
      if (!aDoc || !bDoc) continue;
      if (role !== 'Admin' && (aDoc.school !== school || bDoc.school !== school)) continue;

      if (action === 'bulk_confirm_siblings') {
        await db.collection('students').updateOne(
          { _id: aOid },
          {
            $set: { siblingFlag: false, siblingConfirmed: true, siblingReviewedAt: now },
            $addToSet: { siblingWith: bId },
          },
        );
        await db.collection('students').updateOne(
          { _id: bOid },
          {
            $set: { siblingFlag: false, siblingConfirmed: true, siblingReviewedAt: now },
            $addToSet: { siblingWith: aId },
          },
        );
      } else {
        await db.collection('students').updateOne(
          { _id: aOid },
          {
            $set: { siblingFlag: false, siblingReviewedAt: now },
            $addToSet: { siblingDismissed: bId },
          },
        );
        await db.collection('students').updateOne(
          { _id: bOid },
          {
            $set: { siblingFlag: false, siblingReviewedAt: now },
            $addToSet: { siblingDismissed: aId },
          },
        );
      }
      processed += 1;
    }
    return NextResponse.json({ success: true, action, processed });
  }

  if (!primaryId && action !== 'undo_merge') {
    return NextResponse.json({ error: 'primaryId required' }, { status: 400 });
  }

  // ── UNDO MERGE ───────────────────────────────────────────────────────────────
  if (action === 'undo_merge') {
    let undoPrimaryId = primaryId as string | undefined;
    let undoSecondary = secondary as Record<string, unknown> | undefined;
    let undoChanges: AppliedFieldChange[] = Array.isArray(changes) ? changes : [];
    let undoFilled: string[] = Array.isArray(filledFields) ? filledFields : [];
    let wasTransferred = Boolean(drawerTransferred);
    let historyOid: ObjectId | null = null;

    if (historyId && ObjectId.isValid(String(historyId))) {
      historyOid = new ObjectId(String(historyId));
      const hist = await db.collection(MERGE_HISTORY_COLLECTION).findOne({ _id: historyOid });
      if (!hist) return NextResponse.json({ error: 'Merge history not found' }, { status: 404 });
      if (hist.undoneAt) {
        return NextResponse.json({ error: 'This merge was already undone' }, { status: 409 });
      }
      if (role !== 'Admin' && hist.school && hist.school !== school) {
        return NextResponse.json({ error: 'Forbidden for this school' }, { status: 403 });
      }
      const age = Date.now() - new Date(String(hist.at)).getTime();
      if (age > MERGE_HISTORY_UNDO_MS) {
        return NextResponse.json({
          error: 'Undo window expired (15 minutes). Contact an Admin if you need a manual restore.',
        }, { status: 400 });
      }
      undoPrimaryId = String(hist.primaryId);
      undoSecondary = hist.secondary as Record<string, unknown>;
      undoChanges = Array.isArray(hist.changes) ? hist.changes : [];
      undoFilled = undoChanges.map((c) => c.field);
      wasTransferred = Boolean(hist.drawerTransferred);
    }

    if (!undoPrimaryId || !undoSecondary?._id) {
      return NextResponse.json({ error: 'secondary snapshot (or historyId) required' }, { status: 400 });
    }
    if (!ObjectId.isValid(undoPrimaryId)) {
      return NextResponse.json({ error: 'Invalid primaryId' }, { status: 400 });
    }

    const primaryOid = new ObjectId(undoPrimaryId);
    const primary = await db.collection('students').findOne({ _id: primaryOid });
    if (!primary) return NextResponse.json({ error: 'Primary student not found' }, { status: 404 });
    if (role !== 'Admin' && primary.school !== school) {
      return NextResponse.json({ error: 'Forbidden for this school' }, { status: 403 });
    }

    const secondaryOid = new ObjectId(String(undoSecondary._id));
    if (role !== 'Admin' && undoSecondary.school && undoSecondary.school !== school) {
      return NextResponse.json({ error: 'Forbidden for this school' }, { status: 403 });
    }

    const existing = await db.collection('students').findOne({ _id: secondaryOid });
    if (existing) {
      return NextResponse.json({ error: 'Secondary student already exists' }, { status: 409 });
    }

    const { _id: _ignored, ...rest } = undoSecondary;
    await db.collection('students').insertOne({ ...rest, _id: secondaryOid });

    // If drawer was transferred (not freed), do not re-increment — slot never left the cabinet.
    if (!wasTransferred && undoSecondary.cabinet && undoSecondary.drawer) {
      try {
        const cabinetOid = new ObjectId(String(undoSecondary.cabinet));
        await db.collection('cabinets').updateOne(
          { _id: cabinetOid, 'drawers._id': undoSecondary.drawer },
          { $inc: { currentCount: 1, 'drawers.$.currentCount': 1 } },
        );
      } catch { /* cabinet may not exist — continue */ }
    }

    const fieldsToUnset: Record<string, ''> = { mergedFromId: '' };
    const fieldsToRestore: Record<string, unknown> = {};

    if (undoChanges.length > 0) {
      for (const ch of undoChanges) {
        if (!ch || typeof ch.field !== 'string') continue;
        const current = primary[ch.field];
        const stillMerged =
          ch.next == null
            ? current == null || current === ''
            : current === ch.next || String(current) === String(ch.next);
        if (!stillMerged) continue;
        if (ch.previous == null || ch.previous === '') {
          fieldsToUnset[ch.field] = '';
        } else {
          fieldsToRestore[ch.field] = ch.previous;
        }
      }
    } else {
      for (const field of undoFilled) {
        if (typeof field !== 'string' || !field) continue;
        if (primary[field] === undoSecondary[field]) {
          fieldsToUnset[field] = '';
        }
      }
    }

    if (wasTransferred) {
      for (const field of LOCATION_TRANSFER_FIELDS) {
        if (
          primary[field] === undoSecondary[field]
          || String(primary[field] ?? '') === String(undoSecondary[field] ?? '')
        ) {
          fieldsToUnset[field] = '';
          delete fieldsToRestore[field];
        }
      }
    }

    const update: Record<string, unknown> = {};
    if (Object.keys(fieldsToRestore).length) update.$set = fieldsToRestore;
    if (Object.keys(fieldsToUnset).length) update.$unset = fieldsToUnset;
    if (Object.keys(update).length) {
      await db.collection('students').updateOne({ _id: primaryOid }, update);
    }

    if (historyOid) {
      await db.collection(MERGE_HISTORY_COLLECTION).updateOne(
        { _id: historyOid },
        {
          $set: {
            undoneAt: new Date().toISOString(),
            undoneByEmail: auth.user?.email || '',
          },
        },
      );
    } else if (historyId == null) {
      // Mark matching recent history by primary+secondary if present
      await db.collection(MERGE_HISTORY_COLLECTION).updateOne(
        {
          primaryId: undoPrimaryId,
          secondaryId: String(undoSecondary._id),
          undoneAt: { $exists: false },
        },
        {
          $set: {
            undoneAt: new Date().toISOString(),
            undoneByEmail: auth.user?.email || '',
          },
        },
      );
    }

    return NextResponse.json({
      success: true,
      action: 'undo_merge',
      restoredId: String(secondaryOid),
    });
  }

  if (!primaryId || !ObjectId.isValid(String(primaryId))) {
    return NextResponse.json({ error: 'primaryId required' }, { status: 400 });
  }

  const primaryOid = new ObjectId(primaryId);
  const primary = await db.collection('students').findOne({ _id: primaryOid });
  if (!primary) return NextResponse.json({ error: 'Primary student not found' }, { status: 404 });
  if (role !== 'Admin' && primary.school !== school) {
    return NextResponse.json({ error: 'Forbidden for this school' }, { status: 403 });
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

    if (fieldChoices != null && !isValidMergeChoices(fieldChoices)) {
      return NextResponse.json({ error: 'Invalid fieldChoices' }, { status: 400 });
    }

    const primaryRec = primary as Record<string, unknown>;
    const secondaryRec = secondaryDoc as Record<string, unknown>;
    const applied = fieldChoices != null
      ? applyMergeFieldChoices(primaryRec, secondaryRec, fieldChoices)
      : applyFillIfMissing(primaryRec, secondaryRec);

    const setFields: Record<string, unknown> = {
      siblingFlag: false,
      siblingConfirmed: false,
      siblingReviewedAt: new Date().toISOString(),
      mergedFromId: secondaryId,
    };
    const unsetFields: Record<string, ''> = {};

    for (const [key, value] of Object.entries(applied.setFields)) {
      if (value === null) unsetFields[key] = '';
      else setFields[key] = value;
    }

    const shouldTransferDrawer =
      Boolean(transferDrawer) && canTransferDrawer(primaryRec, secondaryRec);
    const locationChanges: AppliedFieldChange[] = [];

    if (shouldTransferDrawer) {
      for (const field of LOCATION_TRANSFER_FIELDS) {
        const next = secondaryRec[field];
        if (next == null || next === '') continue;
        const previous = primaryRec[field] ?? null;
        setFields[field] = next;
        locationChanges.push({ field, previous, next });
      }
    }

    const updateDoc: Record<string, unknown> = { $set: setFields };
    if (Object.keys(unsetFields).length) updateDoc.$unset = unsetFields;

    const secondarySnapshot = { ...secondaryDoc, _id: secondaryId };
    const allChanges = [...applied.changes, ...locationChanges];
    const filledFromSecondary = allChanges.map((c) => c.field);
    const primaryName = `${primary.firstName || ''} ${primary.lastName || ''}`.trim();
    const secondaryName = `${secondaryDoc.firstName || ''} ${secondaryDoc.lastName || ''}`.trim();

    const historyInsert = await withMongoTransaction(async (session) => {
      await db.collection('students').updateOne({ _id: primaryOid }, updateDoc, { session });

      // If location was transferred, keep the drawer count (primary now occupies the slot).
      // Otherwise free the secondary's drawer when deleting it.
      if (!shouldTransferDrawer && secondaryDoc.cabinet && secondaryDoc.drawer) {
        try {
          const cabinetOid = new ObjectId(secondaryDoc.cabinet);
          await db.collection('cabinets').updateOne(
            { _id: cabinetOid, 'drawers._id': secondaryDoc.drawer },
            { $inc: { currentCount: -1, 'drawers.$.currentCount': -1 } },
            { session },
          );
        } catch { /* cabinet may not exist — continue */ }
      }

      await db.collection('students').deleteOne({ _id: secondaryOid }, { session });

      return db.collection(MERGE_HISTORY_COLLECTION).insertOne({
        at: new Date().toISOString(),
        byEmail: auth.user?.email || '',
        byName: auth.user?.name || '',
        school: primary.school || '',
        primaryId,
        primaryName,
        secondaryId,
        secondaryName,
        secondary: secondarySnapshot,
        changes: allChanges,
        drawerTransferred: shouldTransferDrawer,
      }, { session });
    });

    return NextResponse.json({
      success: true,
      action: 'merge',
      deletedId: secondaryId,
      undo: {
        primaryId,
        secondary: secondarySnapshot,
        filledFields: filledFromSecondary,
        changes: allChanges,
        drawerTransferred: shouldTransferDrawer,
        historyId: String(historyInsert.insertedId),
      },
    });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
