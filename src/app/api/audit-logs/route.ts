import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db("student-label");
    
    // Role-based filtering
    const userRole = (session.user as any)?.role;
    const userSchool = (session.user as any)?.school;
    
    let query: any = {};
    
    // Non-admin users can only see logs from their school
    if (userRole !== 'Admin' && userSchool) {
      query['user.school'] = userSchool;
    }
    
    const logs = await db.collection('audit_logs').find(query).sort({ time: -1 }).toArray();
    return NextResponse.json(logs);
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const body = await req.json();
    
    // Add user information to the audit log
    const auditLogData = {
      ...body,
      time: new Date().toISOString(),
      user: session?.user ? {
        name: session.user.name,
        email: session.user.email,
        role: (session.user as any)?.role,
        school: (session.user as any)?.school
      } : null
    };
    
    const client = await clientPromise;
    const db = client.db("student-label");
    const result = await db.collection('audit_logs').insertOne(auditLogData);
    const insertedLog = { _id: result.insertedId, ...auditLogData };
    return NextResponse.json(insertedLog, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to add audit log' }, { status: 500 });
  }
} 