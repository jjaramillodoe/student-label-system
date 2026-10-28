import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, requireRole } from '@/lib/requireSession';
import clientPromise from '@/lib/mongodb';
import * as bcrypt from 'bcrypt';
import { ObjectId } from 'mongodb';
import { applyMfaBypass, logAuthEvent } from '@/lib/authSecurity';
import { passwordPolicyError } from '@/lib/passwordPolicy';
import { USER_MANAGER_ROLES, canAssignUser, canManageUser } from '@/lib/userManagement';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireRole(USER_MANAGER_ROLES);
  if (!auth.ok) return auth.response;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
  }
  try {
    const client = await clientPromise;
    const db = client.db("student-label");
    const user = await db.collection('users').findOne(
      { _id: new ObjectId(id) },
      { projection: { password: 0, mfaSecret: 0, mfaPendingSecret: 0 } }
    );
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (!canManageUser(auth.user, user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json(user);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireRole(USER_MANAGER_ROLES);
  if (!auth.ok) return auth.response;
  const isAdmin = auth.user.role === 'Admin';
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
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
    if (!canManageUser(auth.user, existingUser) || !canAssignUser(auth.user, { role, school })) {
      return NextResponse.json(
        { error: 'Data Leads can only edit Data Members and Intake Members at their own school' },
        { status: 403 },
      );
    }

    if (normalizedEmail !== existingUser.email) {
      const taken = await db.collection('users').findOne({ email: normalizedEmail, _id: { $ne: existingUser._id } });
      if (taken) {
        return NextResponse.json({ error: 'Another user already has that email' }, { status: 409 });
      }
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
      if (!isAdmin) {
        const policyError = passwordPolicyError(password);
        if (policyError) return NextResponse.json({ error: policyError }, { status: 400 });
        // A password set by a Data Lead is temporary.
        update.forcePasswordChange = true;
      }
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

    // MFA changes stay Admin-only.
    if (isAdmin && typeof mfaBypass === 'boolean') {
      await applyMfaBypass(existingUser._id, normalizedEmail, mfaBypass, {
        byEmail: auth.user?.email || '',
        byName: auth.user?.name || '',
      });
      result.mfaBypass = mfaBypass;
    }

    await logAuthEvent({
      type: 'user_updated',
      email: normalizedEmail,
      reason: `${auth.user.role} updated user${password ? ' and set a new password' : ''}`,
      meta: {
        byEmail: auth.user?.email || '',
        byName: auth.user?.name || '',
        byRole: auth.user.role,
        userId: id,
        previous: { name: existingUser.name, email: existingUser.email, role: existingUser.role, school: existingUser.school },
        next: { name, email: normalizedEmail, role, school },
      },
    });

    const { password: pw, mfaSecret, mfaPendingSecret, ...userWithoutPassword } = result;
    return NextResponse.json(userWithoutPassword);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
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
