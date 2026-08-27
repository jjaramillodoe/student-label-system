import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/requireSession';
import * as bcrypt from 'bcrypt';
import clientPromise from '@/lib/mongodb';
import { generateMfaSecret, getMfaKeyUri, verifyMfaToken } from '@/lib/mfa';

export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;
  const email = auth.user.email?.toLowerCase();

  if (!email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { currentPassword } = await req.json();

    if (!currentPassword) {
      return NextResponse.json({ error: 'Current password is required' }, { status: 400 });
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

    const secret = generateMfaSecret();
    await db.collection('users').updateOne(
      { email },
      {
        $set: {
          mfaPendingSecret: secret,
          updatedAt: new Date().toISOString(),
        },
      }
    );

    return NextResponse.json({
      secret,
      otpauthUrl: getMfaKeyUri(email, secret),
    });
  } catch (error) {
    console.error('Error starting MFA setup:', error);
    return NextResponse.json({ error: 'Failed to start MFA setup' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;
  const email = auth.user.email?.toLowerCase();

  if (!email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { code } = await req.json();

    if (!code) {
      return NextResponse.json({ error: 'Verification code is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('student-label');
    const user = await db.collection('users').findOne<{ mfaPendingSecret?: string }>({ email });

    if (!user?.mfaPendingSecret) {
      return NextResponse.json({ error: 'Start MFA setup before verifying a code' }, { status: 400 });
    }

    if (!(await verifyMfaToken(code, user.mfaPendingSecret))) {
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
    }

    await db.collection('users').updateOne(
      { email },
      {
        $set: {
          mfaEnabled: true,
          mfaSecret: user.mfaPendingSecret,
          updatedAt: new Date().toISOString(),
        },
        $unset: {
          mfaPendingSecret: '',
        },
      }
    );

    return NextResponse.json({ success: true, mfaEnabled: true });
  } catch (error) {
    console.error('Error verifying MFA setup:', error);
    return NextResponse.json({ error: 'Failed to verify MFA setup' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;
  const email = auth.user.email?.toLowerCase();

  if (!email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { currentPassword } = await req.json();

    if (!currentPassword) {
      return NextResponse.json({ error: 'Current password is required' }, { status: 400 });
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

    await db.collection('users').updateOne(
      { email },
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

    return NextResponse.json({ success: true, mfaEnabled: false });
  } catch (error) {
    console.error('Error disabling MFA:', error);
    return NextResponse.json({ error: 'Failed to disable MFA' }, { status: 500 });
  }
}
