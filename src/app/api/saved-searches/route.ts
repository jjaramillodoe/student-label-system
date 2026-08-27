import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/requireSession';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET() {
  try {
    const auth = await requireSession();
    if (!auth.ok) return auth.response;

    const client = await clientPromise;
    const db = client.db("student-label");
    
    const userEmail = auth.user?.email;
    const searches = await db.collection('saved_searches')
      .find({ userEmail })
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json(searches);
  } catch (error) {
    console.error('Error fetching saved searches:', error);
    return NextResponse.json({ error: 'Failed to fetch saved searches' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireSession();
    if (!auth.ok) return auth.response;

    const body = await req.json();
    const client = await clientPromise;
    const db = client.db("student-label");
    
    const searchData = {
      ...body,
      userEmail: auth.user?.email,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const result = await db.collection('saved_searches').insertOne(searchData);
    const insertedSearch = { _id: result.insertedId, ...searchData };
    
    return NextResponse.json(insertedSearch, { status: 201 });
  } catch (error) {
    console.error('Error creating saved search:', error);
    return NextResponse.json({ error: 'Failed to create saved search' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireSession();
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Search ID required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("student-label");
    
    let query: any = { userEmail: auth.user?.email };
    try {
      query._id = new ObjectId(id);
    } catch {
      return NextResponse.json({ error: 'Invalid search ID' }, { status: 400 });
    }
    
    const result = await db.collection('saved_searches').deleteOne(query);

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Search not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting saved search:', error);
    return NextResponse.json({ error: 'Failed to delete saved search' }, { status: 500 });
  }
}

