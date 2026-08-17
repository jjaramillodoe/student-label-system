import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import * as bcrypt from 'bcrypt';
import { ObjectId } from 'mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { applyMfaBypass } from '@/lib/authSecurity';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'Admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const client = await clientPromise;
    const db = client.db("student-label");
    const user = await db.collection('users').findOne(
      { _id: new ObjectId(id) },
      { projection: { password: 0, mfaSecret: 0, mfaPendingSecret: 0 } }
    );
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    return NextResponse.json(user);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'Admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const { name, email, role, school, password, allowedIntakeSessions, mfaBypass } = await req.json();
    const normalizedEmail = typeof email === 'string' ? email.toLowerCase().trim() : '';
    if (!name || !normalizedEmail || !role || !school) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (role === 'Intake Member') {
      if (!Array.isArray(allowedIntakeSessions) || allowedIntakeSessions.length === 0) {
        return NextResponse.json({ error: 'Select at least one intake session for Intake Members' }, { status: 400 });
      }
    }
    const client = await clientPromise;
    const db = client.db("student-label");
    const existingUser = await db.collection('users').findOne({ _id: new ObjectId(id) });
    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const update: any = { 
      name, 
      email: normalizedEmail, 
      role, 
      school,
      allowedIntakeSessions:
        role === 'Intake Member' && Array.isArray(allowedIntakeSessions)
          ? allowedIntakeSessions.filter((s: unknown) => typeof s === 'string' && s.trim())
          : [],
      updatedAt: new Date().toISOString()
    };

    if (password) {
      update.password = await bcrypt.hash(password, 10);
    }

    const result = await db.collection('users').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: update },
      { returnDocument: 'after' }
    );

    if (!result) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (typeof mfaBypass === 'boolean') {
      await applyMfaBypass(existingUser._id, normalizedEmail, mfaBypass, {
        byEmail: session.user?.email || '',
        byName: session.user?.name || '',
      });
      result.mfaBypass = mfaBypass;
    }

    const { password: pw, mfaSecret, mfaPendingSecret, ...userWithoutPassword } = result;
    return NextResponse.json(userWithoutPassword);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'Admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const client = await clientPromise;
    const db = client.db("student-label");
    const result = await db.collection('users').deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
} 