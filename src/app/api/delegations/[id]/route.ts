import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { requireRole } from '@/lib/requireSession';
import { logAuthEvent } from '@/lib/authSecurity';
import { USER_MANAGER_ROLES } from '@/lib/userManagement';
import {
  DELEGATE_BASE_ROLE,
  ROLE_DELEGATIONS_COLLECTION,
  canDelegate,
  delegationPhase,
  type DelegationDoc,
} from '@/lib/delegation';
import { forgetDelegationCache } from '@/lib/delegationSession';

const NOTE_MAX_LENGTH = 200;

/** approve / deny (Admin only, pending requests) or revoke (Admin or the school's Data Lead). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(USER_MANAGER_ROLES);
  if (!auth.ok) return auth.response;
  if (!canDelegate(auth.user)) {
    return NextResponse.json({ error: 'Acting Data Leads cannot manage delegations' }, { status: 403 });
  }

  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid delegation ID' }, { status: 400 });
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');
    const note = String(body.note || '').trim().slice(0, NOTE_MAX_LENGTH);

    const client = await clientPromise;
    const db = client.db('student-label');
    const col = db.collection<DelegationDoc>(ROLE_DELEGATIONS_COLLECTION);
    const _id = new ObjectId(id);
    const doc = await col.findOne({ _id });
    if (!doc) return NextResponse.json({ error: 'Delegation not found' }, { status: 404 });

    const isAdmin = auth.user.role === 'Admin';
    if (!isAdmin && doc.school !== auth.user.school) {
      return NextResponse.json({ error: 'Delegation not found' }, { status: 404 });
    }

    const actor = { email: auth.user.email || '', name: auth.user.name || '' };
    const now = new Date().toISOString();
    const phase = delegationPhase(doc);
    let update: Partial<DelegationDoc>;
    let type: 'delegation_approved' | 'delegation_denied' | 'delegation_revoked';

    if (action === 'approve' || action === 'deny') {
      if (!isAdmin) return NextResponse.json({ error: 'Only an Admin can approve or deny' }, { status: 403 });
      if (doc.status !== 'pending') {
        return NextResponse.json({ error: 'This request was already handled' }, { status: 409 });
      }
      if (action === 'approve') {
        if (delegationPhase({ ...doc, status: 'approved' }) === 'expired') {
          return NextResponse.json({ error: 'These dates have already passed' }, { status: 409 });
        }
        const user = await db.collection('users').findOne({ _id: new ObjectId(doc.userId) });
        if (!user || user.role !== DELEGATE_BASE_ROLE || user.school !== doc.school) {
          return NextResponse.json(
            { error: 'This user is no longer a Data Member at this school' },
            { status: 409 },
          );
        }
      }
      update = {
        status: action === 'approve' ? 'approved' : 'denied',
        reviewedBy: actor,
        reviewedAt: now,
        ...(note ? { reviewNote: note } : {}),
      };
      type = action === 'approve' ? 'delegation_approved' : 'delegation_denied';
    } else if (action === 'revoke') {
      if (phase !== 'pending' && phase !== 'scheduled' && phase !== 'active') {
        return NextResponse.json({ error: 'This delegation is no longer in effect' }, { status: 409 });
      }
      update = { status: 'revoked', revokedBy: actor, revokedAt: now };
      type = 'delegation_revoked';
    } else {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    // Guard on the status we read so two people acting at once cannot both win.
    const result = await col.findOneAndUpdate(
      { _id, status: doc.status },
      { $set: update },
      { returnDocument: 'after' },
    );
    if (!result) return NextResponse.json({ error: 'This delegation just changed; reload' }, { status: 409 });
    forgetDelegationCache(doc.userEmail, doc.school);

    await logAuthEvent({
      type,
      email: doc.userEmail,
      reason: `${auth.user.role} ${update.status} Acting Data Lead ${doc.startDate} to ${doc.endDate}`,
      meta: {
        byEmail: actor.email,
        byName: actor.name,
        byRole: auth.user.role,
        delegationId: id,
        school: doc.school,
        ...(note ? { note } : {}),
      },
    });

    return NextResponse.json({
      delegation: { ...result, _id: String(result._id), phase: delegationPhase(result) },
    });
  } catch (error) {
    console.error('Error updating delegation:', error);
    return NextResponse.json({ error: 'Failed to update delegation' }, { status: 500 });
  }
}
