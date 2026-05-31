import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const client = await clientPromise;
    const db = client.db("student-label");
    
    const cabinet = await db.collection("cabinets").findOne({ _id: new ObjectId(id) });
    if (!cabinet) {
      return NextResponse.json({ error: 'Cabinet not found' }, { status: 404 });
    }

    // Check school access for non-admin users
    const userRole = session.user.role;
    const userSchool = session.user.school;
    
    if (userRole !== 'Admin' && userSchool && cabinet.school !== userSchool) {
      return NextResponse.json({ error: 'Access denied - Cabinet not in your school' }, { status: 403 });
    }

    return NextResponse.json(cabinet);
  } catch (error) {
    console.error('Error fetching cabinet:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== 'Admin' && session.user.role !== 'Data Lead')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, identifier, drawers, totalCapacity, school } = body;

    if (!name || !drawers || !Array.isArray(drawers) || drawers.length === 0 || !school) {
      return NextResponse.json({ error: 'Invalid cabinet data' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("student-label");

    const existingCabinet = await db.collection("cabinets").findOne({ _id: new ObjectId(id) });
    if (!existingCabinet) {
      return NextResponse.json({ error: 'Cabinet not found' }, { status: 404 });
    }

    // Check school access for non-admin users
    const userRole = session.user.role;
    const userSchool = session.user.school;
    
    if (userRole !== 'Admin' && userSchool && existingCabinet.school !== userSchool) {
      return NextResponse.json({ error: 'Access denied - Cabinet not in your school' }, { status: 403 });
    }

    // Check if cabinet with same name and identifier already exists (excluding current cabinet)
    if (identifier) {
      const duplicateCabinet = await db.collection("cabinets").findOne({ 
        name: name, 
        identifier: identifier,
        _id: { $ne: new ObjectId(id) }
      });
      if (duplicateCabinet) {
        return NextResponse.json({ 
          error: 'A cabinet with this name and identifier already exists' 
        }, { status: 400 });
      }
    }

    // Create a map of existing drawer names to their IDs
    const existingDrawerMap = new Map(
      existingCabinet.drawers.map((drawer: any) => [drawer.name, drawer._id])
    );

    const updatedCabinet = {
      name,
      identifier: identifier || null,
      school,
      drawers: drawers.map((drawer: any) => ({
        _id: existingDrawerMap.get(drawer.name) || new ObjectId().toString(), // Preserve existing ID or generate new one
        name: drawer.name,
        capacity: drawer.capacity,
        currentCount: drawer.currentCount || 0
      })),
      totalCapacity,
      currentCount: existingCabinet.currentCount,
      updatedAt: new Date().toISOString()
    };

    await db.collection("cabinets").updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedCabinet }
    );

    return NextResponse.json({ ...updatedCabinet, _id: id });
  } catch (error) {
    console.error('Error updating cabinet:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== 'Admin' && session.user.role !== 'Data Lead')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const client = await clientPromise;
    const db = client.db("student-label");

    const cabinet = await db.collection("cabinets").findOne({ _id: new ObjectId(id) });
    if (!cabinet) {
      return NextResponse.json({ error: 'Cabinet not found' }, { status: 404 });
    }

    // Check school access for non-admin users
    const userRole = session.user.role;
    const userSchool = session.user.school;
    
    if (userRole !== 'Admin' && userSchool && cabinet.school !== userSchool) {
      return NextResponse.json({ error: 'Access denied - Cabinet not in your school' }, { status: 403 });
    }

    if (cabinet.currentCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete cabinet with files' },
        { status: 400 }
      );
    }

    await db.collection("cabinets").deleteOne({ _id: new ObjectId(id) });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting cabinet:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 