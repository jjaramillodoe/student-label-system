import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { ObjectId } from 'mongodb';
import * as bcrypt from 'bcrypt';
import { authOptions } from '@/lib/authOptions';
import clientPromise from '@/lib/mongodb';
import { logAuthEvent } from '@/lib/authSecurity';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);

  if (!session || (session.user as any).role !== 'Admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const { action, password } = await req.json();

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
        reason: 'Admin disabled MFA',
        meta: {
          byEmail: session.user?.email || '',
          byName: session.user?.name || '',
          userId: id,
        },
      });

      return NextResponse.json({ success: true, message: 'MFA disabled. User can re-enroll from Profile.' });
    }

    return NextResponse.json({ error: 'Unknown security action' }, { status: 400 });
  } catch (error) {
    console.error('Error updating user security:', error);
    return NextResponse.json({ error: 'Failed to update user security' }, { status: 500 });
  }
}
