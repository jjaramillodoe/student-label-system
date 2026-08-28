import { NextResponse } from 'next/server';
import { requireSession, requireAdminOrDataLead } from '@/lib/requireSession';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { clampDrawerCapacity, DRAWER_CAPACITY_MAX, DRAWER_CAPACITY_MIN } from '@/lib/drawerSections';
import { cabinetArchiveSetFields, serializeCabinetRecord } from '@/lib/cabinets';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSession();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const client = await clientPromise;
    const db = client.db('student-label');

    const cabinet = await db.collection('cabinets').findOne({ _id: new ObjectId(id) });
    if (!cabinet) {
      return NextResponse.json({ error: 'Cabinet not found' }, { status: 404 });
    }

    const userRole = auth.user.role;
    const userSchool = auth.user.school;

    if (userRole !== 'Admin' && userSchool && cabinet.school !== userSchool) {
      return NextResponse.json({ error: 'Access denied - Cabinet not in your school' }, { status: 403 });
    }

    return NextResponse.json(serializeCabinetRecord(cabinet));
  } catch (error) {
    console.error('Error fetching cabinet:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

type IncomingDrawer = {
  _id?: string;
  name: string;
  capacity: number;
  currentCount?: number;
  locked?: boolean;
};

/**
 * Merge drawers by stable `_id` so renaming a drawer does not orphan student refs.
 * Match order: explicit _id → previous index → name (legacy) → new id.
 */
function mergeDrawersPreserveIds(
  existingDrawers: Array<{ _id?: string; name: string; capacity?: number; currentCount?: number }>,
  incoming: IncomingDrawer[],
) {
  const byId = new Map(
    existingDrawers
      .filter((d) => d._id)
      .map((d) => [String(d._id), d]),
  );
  const byName = new Map(existingDrawers.map((d) => [d.name, d]));
  const usedIds = new Set<string>();

  return incoming.map((drawer, index) => {
    let existing:
      | { _id?: string; name: string; capacity?: number; currentCount?: number }
      | undefined =
      (drawer._id ? byId.get(String(drawer._id)) : undefined) ||
      existingDrawers[index] ||
      byName.get(drawer.name);

    // Avoid reusing the same existing drawer twice when names collide
    if (existing?._id && usedIds.has(String(existing._id))) {
      const byNameMatch = byName.get(drawer.name);
      existing =
        byNameMatch && (!byNameMatch._id || !usedIds.has(String(byNameMatch._id)))
          ? byNameMatch
          : undefined;
    }

    const id = existing?._id ? String(existing._id) : new ObjectId().toString();
    usedIds.add(id);

    return {
      _id: id,
      name: drawer.name,
      capacity: clampDrawerCapacity(Number(drawer.capacity) || 0),
      currentCount: Number(existing?.currentCount) || 0,
      locked: Boolean(
        (drawer as IncomingDrawer & { locked?: boolean }).locked ??
          (existing as { locked?: boolean } | undefined)?.locked,
      ),
    };
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminOrDataLead();
    if (!auth.ok) return auth.response;

    const { id } = await params;
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
    const db = client.db('student-label');

    const existingCabinet = await db.collection('cabinets').findOne({ _id: new ObjectId(id) });
    if (!existingCabinet) {
      return NextResponse.json({ error: 'Cabinet not found' }, { status: 404 });
    }

    const userRole = auth.user.role;
    const userSchool = auth.user.school;

    if (userRole !== 'Admin' && userSchool && existingCabinet.school !== userSchool) {
      return NextResponse.json({ error: 'Access denied - Cabinet not in your school' }, { status: 403 });
    }

    if (identifier) {
      const duplicateCabinet = await db.collection('cabinets').findOne({
        name,
        identifier,
        _id: { $ne: new ObjectId(id) },
      });
      if (duplicateCabinet) {
        return NextResponse.json(
          { error: 'A cabinet with this name and identifier already exists' },
          { status: 400 },
        );
      }
    }

    const mergedDrawers = mergeDrawersPreserveIds(
      existingCabinet.drawers || [],
      drawers,
    );
    const computedTotal = mergedDrawers.reduce((sum, d) => sum + (d.capacity || 0), 0);

    const updatedCabinet = {
      name,
      identifier: identifier || null,
      school,
      drawers: mergedDrawers,
      totalCapacity: computedTotal,
      currentCount: mergedDrawers.reduce((sum, d) => sum + (d.currentCount || 0), 0),
      mapRow: typeof mapRow === 'number' ? mapRow : mapRow === null ? null : existingCabinet.mapRow ?? null,
      mapCol: typeof mapCol === 'number' ? mapCol : mapCol === null ? null : existingCabinet.mapCol ?? null,
      updatedAt: new Date().toISOString(),
    };

    await db.collection('cabinets').updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedCabinet },
    );

    return NextResponse.json(serializeCabinetRecord({ ...existingCabinet, ...updatedCabinet, _id: id }));
  } catch (error) {
    console.error('Error updating cabinet:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminOrDataLead();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const body = await request.json();
    if (typeof body?.isArchived !== 'boolean') {
      return NextResponse.json({ error: 'isArchived must be a boolean' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('student-label');

    const existingCabinet = await db.collection('cabinets').findOne({ _id: new ObjectId(id) });
    if (!existingCabinet) {
      return NextResponse.json({ error: 'Cabinet not found' }, { status: 404 });
    }

    const userRole = auth.user.role;
    const userSchool = auth.user.school;

    if (userRole !== 'Admin' && userSchool && existingCabinet.school !== userSchool) {
      return NextResponse.json({ error: 'Access denied - Cabinet not in your school' }, { status: 403 });
    }

    const archiveFields = cabinetArchiveSetFields(body.isArchived);
    const updatedAt = new Date().toISOString();
    await db.collection('cabinets').updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...archiveFields, updatedAt } },
    );

    const updated = await db.collection('cabinets').findOne({ _id: new ObjectId(id) });
    return NextResponse.json(
      serializeCabinetRecord(updated || { ...existingCabinet, ...archiveFields, _id: id }),
    );
  } catch (error) {
    console.error('Error updating cabinet archive status:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminOrDataLead();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const client = await clientPromise;
    const db = client.db('student-label');

    const cabinet = await db.collection('cabinets').findOne({ _id: new ObjectId(id) });
    if (!cabinet) {
      return NextResponse.json({ error: 'Cabinet not found' }, { status: 404 });
    }

    const userRole = auth.user.role;
    const userSchool = auth.user.school;

    if (userRole !== 'Admin' && userSchool && cabinet.school !== userSchool) {
      return NextResponse.json({ error: 'Access denied - Cabinet not in your school' }, { status: 403 });
    }

    if (cabinet.currentCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete cabinet with files' },
        { status: 400 },
      );
    }

    await db.collection('cabinets').deleteOne({ _id: new ObjectId(id) });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting cabinet:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
