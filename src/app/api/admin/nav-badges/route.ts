import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';

/**
 * Lightweight counts for sidebar badges (Admin / Data Lead).
 * Avoids running the full duplicates / unassigned scanners on every navigation.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  const school = (session?.user as { school?: string } | undefined)?.school;

  if (!session || !['Admin', 'Data Lead'].includes(role || '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

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
