import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { requireRole } from '@/lib/requireSession';
import { logAuthEvent } from '@/lib/authSecurity';
import { USER_MANAGER_ROLES, canManageUser } from '@/lib/userManagement';
import {
  DELEGATE_BASE_ROLE,
  ROLE_DELEGATIONS_COLLECTION,
  canDelegate,
  delegationPhase,
  rangesOverlap,
  schoolToday,
  validateDelegationDates,
  type DelegationDoc,
  type DelegationView,
} from '@/lib/delegation';
import { ensureDelegationIndexes, forgetDelegationCache } from '@/lib/delegationSession';

const REASON_MAX_LENGTH = 200;
const LIST_LIMIT = 200;

function toView(doc: DelegationDoc & { _id: ObjectId }): DelegationView {
  return { ...doc, _id: String(doc._id), phase: delegationPhase(doc) };
}

/** Delegations the caller can see: all for Admins, their school for Data Leads. */
export async function GET() {
  const auth = await requireRole(USER_MANAGER_ROLES);
  if (!auth.ok) return auth.response;
  if (!canDelegate(auth.user)) {
    return NextResponse.json({ error: 'Acting Data Leads cannot manage delegations' }, { status: 403 });
  }

  try {
    const client = await clientPromise;
    const col = client.db('student-label').collection<DelegationDoc>(ROLE_DELEGATIONS_COLLECTION);
    const filter = auth.user.role === 'Admin' ? {} : { school: auth.user.school };
    const docs = await col.find(filter).sort({ requestedAt: -1 }).limit(LIST_LIMIT).toArray();
    return NextResponse.json({ delegations: docs.map(toView) });
  } catch (error) {
    console.error('Error listing delegations:', error);
    return NextResponse.json({ error: 'Failed to load delegations' }, { status: 500 });
  }
}

/** Ask for a Data Member to act as Data Lead. Admin requests are approved immediately. */
export async function POST(req: NextRequest) {
  const auth = await requireRole(USER_MANAGER_ROLES);
  if (!auth.ok) return auth.response;
  if (!canDelegate(auth.user)) {
    return NextResponse.json({ error: 'Acting Data Leads cannot delegate' }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { userId } = body as { userId?: string };
    if (!userId || !ObjectId.isValid(userId)) {
      return NextResponse.json({ error: 'Choose a user' }, { status: 400 });
    }
    const dates = validateDelegationDates(body);
    if ('error' in dates) return NextResponse.json({ error: dates.error }, { status: 400 });
    const reason = String(body.reason || '').trim().slice(0, REASON_MAX_LENGTH);

    const client = await clientPromise;
    const db = client.db('student-label');
    const target = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (target.role !== DELEGATE_BASE_ROLE) {
      return NextResponse.json({ error: 'Only Data Members can act as Data Lead' }, { status: 400 });
    }
    if (!canManageUser(auth.user, target) || !String(target.school || '').trim()) {
      return NextResponse.json({ error: 'You can only delegate to Data Members at your school' }, { status: 403 });
    }

    await ensureDelegationIndexes();
    const col = db.collection<DelegationDoc>(ROLE_DELEGATIONS_COLLECTION);
    const open = await col
      .find({ userId, status: { $in: ['pending', 'approved'] }, endDate: { $gte: schoolToday() } })
      .toArray();
    if (open.some((d) => rangesOverlap(d, dates))) {
      return NextResponse.json(
        { error: 'This user already has a delegation or request for some of these dates' },
        { status: 409 },
      );
    }

    const now = new Date().toISOString();
    const actor = { email: auth.user.email || '', name: auth.user.name || '' };
    const isAdmin = auth.user.role === 'Admin';
    const doc: DelegationDoc = {
      userId,
      userEmail: String(target.email || '').toLowerCase(),
      userName: String(target.name || ''),
      school: String(target.school),
      ...dates,
      reason,
      status: isAdmin ? 'approved' : 'pending',
      requestedBy: { ...actor, role: auth.user.role },
      requestedAt: now,
      ...(isAdmin ? { reviewedBy: actor, reviewedAt: now } : {}),
    };
    const result = await col.insertOne(doc);
    forgetDelegationCache(doc.userEmail, doc.school);

    await logAuthEvent({
      type: isAdmin ? 'delegation_approved' : 'delegation_requested',
      email: doc.userEmail,
      reason: isAdmin
        ? `Admin made this user Acting Data Lead ${doc.startDate} to ${doc.endDate}`
        : `Data Lead asked for this user to act as Data Lead ${doc.startDate} to ${doc.endDate}`,
      meta: {
        byEmail: actor.email,
        byName: actor.name,
        byRole: auth.user.role,
        delegationId: String(result.insertedId),
        school: doc.school,
        startDate: doc.startDate,
        endDate: doc.endDate,
        reason,
      },
    });

    return NextResponse.json(
      { delegation: toView({ ...doc, _id: result.insertedId }) },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error creating delegation:', error);
    return NextResponse.json({ error: 'Failed to create delegation' }, { status: 500 });
  }
}
