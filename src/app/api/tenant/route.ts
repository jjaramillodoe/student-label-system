import { NextRequest, NextResponse } from 'next/server';
import { findSchoolBySlug } from '@/lib/schoolConfig';
import {
  extractTenantSlugFromHost,
  getTenantRootDomain,
  schoolPortalUrl,
  TENANT_SLUG_HEADER,
} from '@/lib/tenantHost';

/**
 * GET /api/tenant — resolve school portal from current Host (or x-tenant-slug).
 * Public: used on sign-in to show which school portal the user is on.
 */
export async function GET(req: NextRequest) {
  try {
    const rootDomain = getTenantRootDomain();
    const fromHeader = req.headers.get(TENANT_SLUG_HEADER);
    const fromHost = extractTenantSlugFromHost(req.headers.get('host'), rootDomain);
    const slug = (fromHeader || fromHost || '').trim().toLowerCase() || null;

    if (!slug) {
      return NextResponse.json({
        mode: 'apex',
        rootDomain: rootDomain || null,
        slug: null,
        school: null,
        portalUrl: null,
        message: rootDomain
          ? 'District / apex host — no school subdomain'
          : 'Set TENANT_ROOT_DOMAIN to enable school subdomains (e.g. nycadultedlabels.nyc)',
      });
    }

    const school = await findSchoolBySlug(slug);
    if (!school || school.active === false) {
      return NextResponse.json(
        {
          mode: 'unknown',
          rootDomain: rootDomain || null,
          slug,
          school: null,
          portalUrl: schoolPortalUrl(slug),
          error: `No active school for subdomain "${slug}"`,
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      mode: 'school',
      rootDomain: rootDomain || null,
      slug: school.slug || slug,
      school: {
        _id: school._id,
        name: school.name,
        type: school.type,
        agencyId: school.agencyId || null,
        slug: school.slug || slug,
      },
      portalUrl: schoolPortalUrl(school.slug || slug),
    });
  } catch (error) {
    console.error('[tenant]', error);
    return NextResponse.json({ error: 'Failed to resolve tenant' }, { status: 500 });
  }
}
