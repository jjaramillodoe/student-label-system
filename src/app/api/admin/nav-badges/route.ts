import { NextResponse } from 'next/server';
import { requireAdminOrDataLead } from '@/lib/requireSession';
import clientPromise from '@/lib/mongodb';

/**
 * Lightweight counts for sidebar badges (Admin / Data Lead).
 * Avoids running the full duplicates / unassigned scanners on every navigation.
 */
export async function GET() {
  const auth = await requireAdminOrDataLead();
  if (!auth.ok) return auth.response;
  const role = auth.user.role;
  const school = auth.user.school;

  const client = await clientPromise;
  const db = client.db('student-label');
  const schoolFilter: Record<string, unknown> =
    role !== 'Admin' && school ? { school } : {};

  const activeFilter = { ...schoolFilter, archived: { $ne: true } };

  const [duplicatesFlagged, unassignedMissing] = await Promise.all([
    db.collection('students').countDocuments({
      ...activeFilter,
      siblingFlag: true,
    }),
    db.collection('students').countDocuments({
      ...activeFilter,
      $or: [
        { cabinet: { $exists: false } },
        { cabinet: null },
        { cabinet: '' },
        { drawer: { $exists: false } },
        { drawer: null },
        { drawer: '' },
      ],
    }),
  ]);

  return NextResponse.json({
    duplicates: duplicatesFlagged,
    unassigned: unassignedMissing,
  });
}
