import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/requireSession';
import clientPromise from '@/lib/mongodb';

/**
 * GET /api/intake/data-lead
 * Returns the name and email of the Data Lead (or Admin) for the session user's school.
 * Only exposes the minimum contact info needed by the intake form.
 */
export async function GET() {
  try {
    const auth = await requireSession();
    if (!auth.ok) return auth.response;

    const school = auth.user.school;
    if (!school) return NextResponse.json({ lead: null });

    const client = await clientPromise;
    const db = client.db('student-label');

    // Prefer Data Lead; fall back to Admin for the same school
    const lead = await db.collection('users').findOne(
      { school, role: 'Data Lead' },
      { projection: { name: 1, email: 1, role: 1 } }
    ) ?? await db.collection('users').findOne(
      { school, role: 'Admin' },
      { projection: { name: 1, email: 1, role: 1 } }
    );

    return NextResponse.json({
      lead: lead ? { name: lead.name, email: lead.email, role: lead.role } : null,
    });
  } catch (error) {
    console.error('Data lead lookup error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
