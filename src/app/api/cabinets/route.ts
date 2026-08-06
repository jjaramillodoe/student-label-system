import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { computeCabinetFillForecast } from '@/lib/cabinetCapacity';
import { clampDrawerCapacity, DRAWER_CAPACITY_MAX, DRAWER_CAPACITY_MIN } from '@/lib/drawerSections';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db('student-label');
    const withForecast = req.nextUrl.searchParams.get('forecast') !== '0';

    let query = {};
    const userRole = session.user.role;
    const userSchool = session.user.school;

    if (userRole !== 'Admin' && userSchool) {
      query = { school: userSchool };
    }

    const cabinets = await db.collection('cabinets').find(query).toArray();

    const serializeCabinet = (cabinet: Record<string, any>, fillForecast: unknown = undefined) => ({
      ...cabinet,
      _id: String(cabinet._id),
      drawers: (cabinet.drawers || []).map((d: Record<string, any>) => ({
        ...d,
        _id: String(d._id ?? ''),
      })),
      ...(fillForecast !== undefined ? { fillForecast } : {}),
    });

    if (!withForecast) {
      return NextResponse.json(cabinets.map((c) => serializeCabinet(c)));
    }

    const enriched = await Promise.all(
      cabinets.map(async (cabinet) => {
        if ((cabinet.status ?? 'Active') === 'Archived') {
          return serializeCabinet(cabinet, null);
        }
        const fillForecast = await computeCabinetFillForecast(db, {
          _id: String(cabinet._id),
          currentCount: cabinet.currentCount,
          totalCapacity: cabinet.totalCapacity,
        });
        return serializeCabinet(cabinet, fillForecast);
      }),
    );

    return NextResponse.json(enriched);
  } catch (error) {
    console.error('Error fetching cabinets:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== 'Admin' && session.user.role !== 'Data Lead')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, identifier, drawers, totalCapacity, school, mapRow, mapCol } = body;

    if (!name || !drawers || !Array.isArray(drawers) || drawers.length === 0 || !school) {
      return NextResponse.json({ error: 'Invalid cabinet data' }, { status: 400 });
    }

    for (const drawer of drawers) {
      const cap = Number(drawer?.capacity);
      if (!Number.isFinite(cap) || cap < DRAWER_CAPACITY_MIN || cap > DRAWER_CAPACITY_MAX) {
        return NextResponse.json({
          error: `Each drawer capacity must be between ${DRAWER_CAPACITY_MIN} and ${DRAWER_CAPACITY_MAX} files`,
        }, { status: 400 });
      }
    }

    const client = await clientPromise;
    const db = client.db("student-label");

    // Check if cabinet with same name and identifier already exists
    if (identifier) {
      const existingCabinet = await db.collection("cabinets").findOne({ 
        name: name, 
        identifier: identifier 
      });
      if (existingCabinet) {
        return NextResponse.json({ 
          error: 'A cabinet with this name and identifier already exists' 
        }, { status: 400 });
      }
    }

    const normalizedDrawers = drawers.map((drawer: any) => ({
      _id: new ObjectId().toString(),
      name: drawer.name,
      capacity: clampDrawerCapacity(drawer.capacity),
      currentCount: 0,
      locked: Boolean(drawer.locked),
    }));
    const computedTotal = normalizedDrawers.reduce((sum, d) => sum + d.capacity, 0);

    const cabinet = {
      name,
      identifier: identifier || null,
      school,
      drawers: normalizedDrawers,
      totalCapacity: computedTotal,
      currentCount: 0,
      mapRow: typeof mapRow === 'number' ? mapRow : null,
      mapCol: typeof mapCol === 'number' ? mapCol : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const result = await db.collection("cabinets").insertOne(cabinet);

    return NextResponse.json({ ...cabinet, _id: result.insertedId });
  } catch (error) {
    console.error('Error creating cabinet:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 