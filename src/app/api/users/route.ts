import { NextRequest, NextResponse } from 'next/server';
import { requireSession, requireRole } from '@/lib/requireSession';
import clientPromise from '@/lib/mongodb';
import * as bcrypt from 'bcrypt';
import { logAuthEvent } from '@/lib/authSecurity';
import { passwordPolicyError } from '@/lib/passwordPolicy';
import { USER_MANAGER_ROLES, canAssignUser, userListFilter } from '@/lib/userManagement';

export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  try {
    const client = await clientPromise;
    const db = client.db("student-label");
    
    // Check if user is requesting their own profile
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    
    if (email) {
      // Allow users to fetch their own profile by email
      if (auth.user?.email === email || auth.user.role === 'Admin') {
        const user = await db.collection('users').findOne(
          { email },
          { projection: { password: 0, mfaSecret: 0, mfaPendingSecret: 0 } }
        );
        if (!user) {
          return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        return NextResponse.json(user);
      } else {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
    
    // Admins see everyone; Data Leads see users at their own school
    const filter = userListFilter(auth.user);
    if (!filter) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const users = await db.collection('users').find(filter, { projection: { password: 0, mfaSecret: 0, mfaPendingSecret: 0 } }).toArray();
    return NextResponse.json(users);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(USER_MANAGER_ROLES);
  if (!auth.ok) return auth.response;
  const isAdmin = auth.user.role === 'Admin';
  try {
    const { name, email, role, school, password, allowedIntakeSessions, mfaBypass: requestedMfaBypass } = await req.json();
    const normalizedEmail = typeof email === 'string' ? email.toLowerCase().trim() : '';
    if (!name || !normalizedEmail || !role || !school || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (!canAssignUser(auth.user, { role, school })) {
      return NextResponse.json(
        { error: 'Data Leads can only add Data Members and Intake Members at their own school' },
        { status: 403 },
      );
    }
    // Data Leads set a temporary password that must meet the policy and be changed at first sign-in.
    if (!isAdmin) {
      const policyError = passwordPolicyError(password);
      if (policyError) return NextResponse.json({ error: policyError }, { status: 400 });
    }
    const mfaBypass = isAdmin && requestedMfaBypass === true;
    if (role === 'Intake Member') {
      if (!Array.isArray(allowedIntakeSessions) || allowedIntakeSessions.length === 0) {
        return NextResponse.json({ error: 'Select at least one intake session for Intake Members' }, { status: 400 });
      }
    }
    const client = await clientPromise;
    const db = client.db("student-label");
    const existing = await db.collection('users').findOne({ email: normalizedEmail });
    if (existing) {
      return NextResponse.json({ error: 'User already exists' }, { status: 409 });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();
    const userData = {
      name,
      email: normalizedEmail,
      role,
      school,
      allowedIntakeSessions:
        role === 'Intake Member' && Array.isArray(allowedIntakeSessions)
          ? allowedIntakeSessions.filter((s: unknown) => typeof s === 'string' && s.trim())
          : [],
      password: hashedPassword,
      mfaBypass,
      ...(isAdmin ? {} : { forcePasswordChange: true }),
      createdAt: now,
      lastLogin: null
    };
    const result = await db.collection('users').insertOne(userData);
    await logAuthEvent({
      type: 'user_created',
      email: normalizedEmail,
      reason: mfaBypass
        ? 'Admin created user with MFA disabled'
        : `${auth.user.role} created user`,
      meta: {
        role,
        school,
        byEmail: auth.user?.email || '',
        byName: auth.user?.name || '',
        byRole: auth.user.role,
        userId: String(result.insertedId),
        mfaBypass,
      },
    });
    if (mfaBypass) {
      await logAuthEvent({
        type: 'mfa_disabled',
        email: normalizedEmail,
        reason: 'Admin created user with MFA disabled (login bypass for testing/QA)',
        meta: {
          byEmail: auth.user?.email || '',
          byName: auth.user?.name || '',
          userId: String(result.insertedId),
          bypass: true,
        },
      });
    }
    const { password: _, ...userWithoutPassword } = userData;
    return NextResponse.json({ ...userWithoutPassword, _id: result.insertedId });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
} 