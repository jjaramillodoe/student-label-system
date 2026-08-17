import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { ObjectId } from 'mongodb';
import * as bcrypt from 'bcrypt';
import { authOptions } from '@/lib/authOptions';
import clientPromise from '@/lib/mongodb';
import { applyMfaBypass, isAccountLocked, logAuthEvent, unlockAccount } from '@/lib/authSecurity';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);

  if (!session || (session.user as any).role !== 'Admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const { action, password, bypass } = await req.json();

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('student-label');
    const users = db.collection('users');
    const user = await users.findOne({ _id: new ObjectId(id) });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (action === 'reset-password') {
      if (!password || password.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
      }

      await users.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            password: await bcrypt.hash(password, 10),
            forcePasswordChange: true,
            updatedAt: new Date().toISOString(),
          },
        }
      );

      return NextResponse.json({ success: true, message: 'Password reset. User must change it on next login.' });
    }

    if (action === 'force-password-change') {
      await users.updateOne(
        { _id: new ObjectId(id) },
        { $set: { forcePasswordChange: true, updatedAt: new Date().toISOString() } }
      );

      return NextResponse.json({ success: true, message: 'User will be forced to change password on next login.' });
    }

    if (action === 'clear-force-password-change') {
      await users.updateOne(
        { _id: new ObjectId(id) },
        { $set: { forcePasswordChange: false, updatedAt: new Date().toISOString() } }
      );

      return NextResponse.json({ success: true, message: 'Forced password change cleared.' });
    }

    if (action === 'set-mfa-bypass') {
      const nextBypass = bypass === true;
      await applyMfaBypass(user._id, String(user.email || ''), nextBypass, {
        byEmail: session.user?.email || '',
        byName: session.user?.name || '',
      });
      return NextResponse.json({
        success: true,
        mfaBypass: nextBypass,
        message: nextBypass
          ? 'MFA disabled. This user can sign in without an authenticator code.'
          : 'MFA re-enabled. This user must complete MFA at next password sign-in.',
      });
    }

    if (action === 'disable-mfa') {
      await users.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            mfaEnabled: false,
            updatedAt: new Date().toISOString(),
          },
          $unset: {
            mfaSecret: '',
            mfaPendingSecret: '',
          },
        }
      );

      await logAuthEvent({
        type: 'mfa_disabled',
        email: String(user.email || ''),
        reason: 'Admin reset MFA enrollment',
        meta: {
          byEmail: session.user?.email || '',
          byName: session.user?.name || '',
          userId: id,
          reset: true,
        },
      });

      return NextResponse.json({ success: true, message: 'MFA enrollment reset. User can re-enroll from Profile.' });
    }

    if (action === 'unlock-account') {
      const lockedUntil = (user as { lockedUntil?: string | null }).lockedUntil;
      const failedLoginCount = Number((user as { failedLoginCount?: number }).failedLoginCount || 0);
      if (!isAccountLocked({ lockedUntil }) && !failedLoginCount) {
        return NextResponse.json({ success: true, message: 'Account is not locked.' });
      }
      await unlockAccount(new ObjectId(id), String(user.email || ''), {
        byEmail: session.user?.email || '',
        byName: session.user?.name || '',
      });
      return NextResponse.json({
        success: true,
        message: 'Account unlocked. User can sign in again.',
      });
    }

    return NextResponse.json({ error: 'Unknown security action' }, { status: 400 });
  } catch (error) {
    console.error('Error updating user security:', error);
    return NextResponse.json({ error: 'Failed to update user security' }, { status: 500 });
  }
}
