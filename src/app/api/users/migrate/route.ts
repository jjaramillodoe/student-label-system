import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { destructiveHttpGuard } from '@/lib/destructiveHttp';
import { requireAdmin } from '@/lib/requireSession';

export async function POST(req: NextRequest) {
  const blocked = destructiveHttpGuard();
  if (blocked) return blocked;

  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

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