import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/requireSession';
import * as bcrypt from 'bcrypt';
import clientPromise from '@/lib/mongodb';
import { passwordPolicyError } from '@/lib/passwordPolicy';

export async function PUT(req: NextRequest) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;
  const email = auth.user.email?.toLowerCase();

  if (!email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Current password and new password are required' }, { status: 400 });
    }

    const policyError = passwordPolicyError(newPassword);
    if (policyError) {
      return NextResponse.json({ error: policyError }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('student-label');
    const user = await db.collection('users').findOne<{ password?: string }>({ email });

    if (!user?.password) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.collection('users').updateOne(
      { email },
      {
        $set: {
          password: hashedPassword,
          forcePasswordChange: false,
          updatedAt: new Date().toISOString(),
        },
      }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error changing password:', error);
    return NextResponse.json({ error: 'Failed to change password' }, { status: 500 });
  }
}
