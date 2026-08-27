import { NextResponse } from 'next/server';
import { requireAdminOrDataLead } from '@/lib/requireSession';
import { findSchoolBySlug } from '@/lib/schoolConfig';

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const auth = await requireAdminOrDataLead();
  if (!auth.ok) return auth.response;

  try {
    const { slug } = await context.params;
    const school = await findSchoolBySlug(slug);

    if (!school) {
      return NextResponse.json({ error: 'School/program not found' }, { status: 404 });
    }

    const role = auth.user?.role;
    const userSchool = auth.user?.school?.trim();

    if (
      role === 'Data Lead' &&
      userSchool &&
      school.name.toLowerCase() !== userSchool.toLowerCase()
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(school);
  } catch (error) {
    console.error('Error fetching school by slug:', error);
    return NextResponse.json({ error: 'Failed to fetch school/program' }, { status: 500 });
  }
}
