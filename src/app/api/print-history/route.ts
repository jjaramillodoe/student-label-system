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

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const userId = searchParams.get('userId');
    const studentId = searchParams.get('studentId');
    const limit = parseInt(searchParams.get('limit') || '100');

    const client = await clientPromise;
    const db = client.db("student-label");

    let query: any = {};

    // Filter by date range
    if (startDate || endDate) {
      query.time = {};
      if (startDate) query.time.$gte = new Date(startDate);
      if (endDate) query.time.$lte = new Date(endDate);
    }

    // Filter by user
    if (userId) {
      query['user.email'] = userId;
    }

    // Filter by student
    if (studentId) {
      query['students.studentId'] = studentId;
    }

    // Role-based filtering
    const userRole = (session.user as any)?.role;
    const userSchool = (session.user as any)?.school;
    if (userRole !== 'Admin' && userSchool) {
      query['user.school'] = userSchool;
    }

    const logs = await db.collection('print_history')
      .find(query)
      .sort({ time: -1 })
      .limit(limit)
      .toArray();

    return NextResponse.json(logs);
  } catch (error) {
    console.error('Error fetching print history:', error);
    return NextResponse.json({ error: 'Failed to fetch print history' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    
    const printLog = {
      ...body,
      time: new Date().toISOString(),
      user: session.user ? {
        name: session.user.name,
        email: session.user.email,
        role: (session.user as any)?.role,
        school: (session.user as any)?.school
      } : null
    };

    const client = await clientPromise;
    const db = client.db("student-label");
    const result = await db.collection('print_history').insertOne(printLog);
    const insertedLog = { _id: result.insertedId, ...printLog };
    
    return NextResponse.json(insertedLog, { status: 201 });
  } catch (error) {
    console.error('Error creating print history:', error);
    return NextResponse.json({ error: 'Failed to create print history' }, { status: 500 });
  }
}

