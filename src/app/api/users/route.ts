import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import * as bcrypt from 'bcrypt';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { logAuthEvent } from '@/lib/authSecurity';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const client = await clientPromise;
    const db = client.db("student-label");
    
    // Check if user is requesting their own profile
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    
    if (email) {
      // Allow users to fetch their own profile by email
      if (session.user?.email === email || (session.user as any).role === 'Admin') {
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
    
    // Admin-only: fetch all users
    if ((session.user as any).role !== 'Admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const users = await db.collection('users').find({}, { projection: { password: 0, mfaSecret: 0, mfaPendingSecret: 0 } }).toArray();
    return NextResponse.json(users);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'Admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const { name, email, role, school, password, allowedIntakeSessions } = await req.json();
    const normalizedEmail = typeof email === 'string' ? email.toLowerCase().trim() : '';
    if (!name || !normalizedEmail || !role || !school || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
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
      createdAt: now,
      lastLogin: null
    };
    const result = await db.collection('users').insertOne(userData);
    await logAuthEvent({
      type: 'user_created',
      email: normalizedEmail,
      reason: 'Admin created user',
      meta: {
        role,
        school,
        byEmail: session.user?.email || '',
        byName: session.user?.name || '',
        userId: String(result.insertedId),
      },
    });
    const { password: _, ...userWithoutPassword } = userData;
    return NextResponse.json({ ...userWithoutPassword, _id: result.insertedId });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
} 