import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'Admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const client = await clientPromise;
    const db = client.db("student-label");
    const users = await db.collection('users').find({}).toArray();
    
    const now = new Date().toISOString();
    const updates = users.map(user => ({
      updateOne: {
        filter: { _id: user._id },
        update: {
          $set: {
            createdAt: user.createdAt || now,
            lastLogin: user.lastLogin || null,
            updatedAt: now
          }
        }
      }
    }));

    if (updates.length > 0) {
      await db.collection('users').bulkWrite(updates);
    }

    return NextResponse.json({ 
      success: true, 
      message: `Updated ${updates.length} users with timestamp fields` 
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({ error: 'Failed to migrate users' }, { status: 500 });
  }
} 