import type { NextRequest } from 'next/server';

/**
 * New York State geo wall for production (nycadultedlabels.nyc).
 *
 * Env:
 *   GEO_RESTRICT_NY=1  — force on (any environment)
 *   GEO_RESTRICT_NY=0  — force off
 *   unset              — on in Vercel production only
 *
 * Machine paths (cron, Power Automate sync, health) always bypass.
 */

export function isGeoRestrictNyEnabled(): boolean {
  const flag = (process.env.GEO_RESTRICT_NY || '').trim().toLowerCase();
  if (flag === '0' || flag === 'false' || flag === 'off') return false;
  if (flag === '1' || flag === 'true' || flag === 'on') return true;
  return process.env.VERCEL_ENV === 'production';
}

/** Paths that must stay reachable from outside NY (automation / monitoring). */
export function isGeoBypassPath(pathname: string): boolean {
  return (
    pathname === '/geo-blocked' ||
    pathname.startsWith('/api/cron/') ||
    pathname.startsWith('/api/sync') ||
    pathname.startsWith('/api/health') ||
    pathname.startsWith('/api/openapi.json')
  );
}

export function getRequestGeo(req: NextRequest): {
  country: string | null;
  region: string | null;
} {
  // Vercel sets these on Edge; also read optional NextRequest.geo when present
  const geo = (req as NextRequest & {
    geo?: { country?: string | null; region?: string | null };
  }).geo;
  const country =
    geo?.country ||
    req.headers.get('x-vercel-ip-country') ||
    null;
  const region =
    geo?.region ||
    req.headers.get('x-vercel-ip-country-region') ||
    null;
  return {
    country: country ? country.toUpperCase() : null,
    region: region ? region.toUpperCase() : null,
  };
}

/**
 * Allow when:
 * - geo wall disabled
 * - bypass path
 * - country=US and region=NY
 * - missing geo in non-production (local / preview without headers)
 */
export function isAllowedByNyGeoWall(req: NextRequest): boolean {
  if (!isGeoRestrictNyEnabled()) return true;

  const path = req.nextUrl.pathname;
  if (isGeoBypassPath(path)) return true;

  const { country, region } = getRequestGeo(req);

  // Local/dev without Vercel geo headers — do not lock developers out
  if (!country && process.env.VERCEL_ENV !== 'production') {
    return true;
  }

  return country === 'US' && region === 'NY';
}
