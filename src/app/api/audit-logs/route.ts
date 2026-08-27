import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/requireSession';
import clientPromise from '@/lib/mongodb';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireSession();
    if (!auth.ok) return auth.response;

    const client = await clientPromise;
    const db = client.db("student-label");
    
    // Role-based filtering
    const userRole = auth.user?.role;
    const userSchool = auth.user?.school;
    
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
    const auth = await requireSession();
    if (!auth.ok) return auth.response;
    const body = await req.json();
    
    // Add user information to the audit log
    const auditLogData = {
      ...body,
      time: new Date().toISOString(),
      user: {
        name: auth.user.name,
        email: auth.user.email,
        role: auth.user.role,
        school: auth.user.school
      }
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