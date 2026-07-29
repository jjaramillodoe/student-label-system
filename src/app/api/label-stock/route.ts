import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { ObjectId } from 'mongodb';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db("student-label");
    
    const stock = await db.collection('label_stock').find({}).sort({ template: 1 }).toArray();
    return NextResponse.json(stock);
  } catch (error) {
    console.error('Error fetching label stock:', error);
    return NextResponse.json({ error: 'Failed to fetch label stock' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const client = await clientPromise;
    const db = client.db("student-label");
    
    const stockData = {
      ...body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const result = await db.collection('label_stock').insertOne(stockData);
    const insertedStock = { _id: result.insertedId, ...stockData };
    
    return NextResponse.json(insertedStock, { status: 201 });
  } catch (error) {
    console.error('Error creating label stock:', error);
    return NextResponse.json({ error: 'Failed to create label stock' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { _id, ...updateData } = body;
    
    if (!_id) {
      return NextResponse.json({ error: 'Stock ID required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("student-label");
    
    const result = await db.collection('label_stock').findOneAndUpdate(
      { _id: new ObjectId(_id) },
      { 
        $set: { 
          ...updateData,
          updatedAt: new Date().toISOString()
        } 
      },
      { returnDocument: 'after' }
    );

    if (!result) {
      return NextResponse.json({ error: 'Stock not found' }, { status: 404 });
    }

    // Fire-and-forget low-stock email (deduped 24h per template)
    void import('@/lib/notifications')
      .then(({ maybeNotifyLowStock }) => maybeNotifyLowStock(db, result as {
        template?: string;
        currentStock?: number;
        lowStockThreshold?: number;
      }))
      .catch((err) => console.error('[label-stock] notify failed', err));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating label stock:', error);
    return NextResponse.json({ error: 'Failed to update label stock' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Stock ID required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("student-label");
    
    const result = await db.collection('label_stock').deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Stock not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting label stock:', error);
    return NextResponse.json({ error: 'Failed to delete label stock' }, { status: 500 });
  }
}

