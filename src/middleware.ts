import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { isAllowedByNyGeoWall } from '@/lib/geoRestrict';
import {
  isIntakeMemberApiAllowed,
  isIntakeMemberPageAllowed,
} from '@/lib/intakeMemberAccess';
import {
  extractTenantSlugFromHost,
  getTenantRootDomain,
  TENANT_ROOT_HEADER,
  TENANT_SLUG_HEADER,
} from '@/lib/tenantHost';
import {
  AUTH_POST_RATE,
  LOOKUP_RATE,
  SYNC_RATE,
  clientIp,
  consumeRateLimit,
  rateLimitResponse,
} from '@/lib/rateLimit';

function isPublicPath(pathname: string): boolean {
  return (
    pathname.startsWith('/auth') ||
    pathname.startsWith('/geo-blocked') ||
    pathname.startsWith('/student') ||
    pathname.startsWith('/archive') ||
    pathname.startsWith('/docs') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/students/lookup') ||
    pathname.startsWith('/api/archive') ||
    // Liveness is unauthenticated; deep still skips JWT here so Bearer probes work,
    // then the route requires Admin session or HEALTH_PROBE_SECRET / CRON_SECRET.
    pathname === '/api/health' ||
    pathname === '/api/health/deep' ||
    pathname.startsWith('/api/sync') ||
    pathname.startsWith('/api/cron/') ||
    pathname.startsWith('/api/tenant') ||
    pathname.startsWith('/api/openapi.json')
  );
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const rootDomain = getTenantRootDomain();
  const tenantSlug = extractTenantSlugFromHost(req.headers.get('host'), rootDomain);

  const requestHeaders = new Headers(req.headers);
  const requestId = req.headers.get('x-request-id')?.trim() || crypto.randomUUID();
  requestHeaders.set('x-request-id', requestId);
  if (tenantSlug) {
    requestHeaders.set(TENANT_SLUG_HEADER, tenantSlug);
  }
  if (rootDomain) {
    requestHeaders.set(TENANT_ROOT_HEADER, rootDomain);
  }

  const withTenantHeaders = (res: NextResponse) => {
    if (tenantSlug) res.headers.set(TENANT_SLUG_HEADER, tenantSlug);
    if (rootDomain) res.headers.set(TENANT_ROOT_HEADER, rootDomain);
    res.headers.set('x-request-id', requestId);
    return res;
  };

  // New York State wall — before auth (production / GEO_RESTRICT_NY=1)
  if (!isAllowedByNyGeoWall(req)) {
    if (path.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Forbidden', detail: 'This service is only available from New York State.' },
        { status: 403 },
      );
    }
    const blocked = new URL('/geo-blocked', req.url);
    return withTenantHeaders(NextResponse.rewrite(blocked));
  }

  const ip = clientIp(req);
  if (path === '/api/students/lookup' || path.startsWith('/api/archive/box')) {
    const limited = consumeRateLimit({ key: `mw-lookup:${ip}`, ...LOOKUP_RATE });
    if (!limited.ok) return withTenantHeaders(rateLimitResponse(limited.retryAfterSec));
  }
  if (path.startsWith('/api/sync')) {
    const limited = consumeRateLimit({ key: `mw-sync:${ip}`, ...SYNC_RATE });
    if (!limited.ok) return withTenantHeaders(rateLimitResponse(limited.retryAfterSec));
  }
  if (req.method === 'POST' && path.startsWith('/api/auth')) {
    const limited = consumeRateLimit({ key: `mw-auth:${ip}`, ...AUTH_POST_RATE });
    if (!limited.ok) return withTenantHeaders(rateLimitResponse(limited.retryAfterSec));
  }

  if (isPublicPath(path)) {
    return withTenantHeaders(
      NextResponse.next({ request: { headers: requestHeaders } }),
    );
  }

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    if (path.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const signInUrl = new URL('/auth/signin', req.url);
    const callback = `${path}${req.nextUrl.search || ''}`;
    if (callback && callback !== '/') {
      signInUrl.searchParams.set('callbackUrl', callback);
    }
    return withTenantHeaders(NextResponse.redirect(signInUrl));
  }

  // Credentials login without MFA: only Profile (enroll) + limited APIs
  if (token.forceMfaSetup) {
    if (path.startsWith('/api')) {
      const apiOk =
        path.startsWith('/api/auth') ||
        path.startsWith('/api/profile') ||
        path.startsWith('/api/users') ||
        path.startsWith('/api/tenant');
      if (!apiOk) {
        return NextResponse.json(
          { error: 'MFA enrollment required before using the app.' },
          { status: 403 },
        );
      }
    } else {
      const allowed =
        path.startsWith('/profile') ||
        path.startsWith('/auth') ||
        path.startsWith('/docs') ||
        path.startsWith('/geo-blocked');
      if (!allowed) {
        return withTenantHeaders(
          NextResponse.redirect(new URL('/profile?enrollMfa=1', req.url)),
        );
      }
    }
  }

  // Forced password change: keep them on profile until updated
  if (token.forcePasswordChange && !path.startsWith('/api') && !path.startsWith('/profile') && !path.startsWith('/auth')) {
    return withTenantHeaders(
      NextResponse.redirect(new URL('/profile?changePassword=1', req.url)),
    );
  }

  // Intake Members: intake / profile / docs / public pages, plus an API allowlist
  if (token.role === 'Intake Member') {
    if (path.startsWith('/api')) {
      if (!isIntakeMemberApiAllowed(path, req.method)) {
        return NextResponse.json(
          { error: 'Forbidden — Intake Members cannot access this API.' },
          { status: 403 },
        );
      }
    } else if (!isIntakeMemberPageAllowed(path)) {
      return withTenantHeaders(
        NextResponse.redirect(new URL('/intake', req.url)),
      );
    }
  }

  return withTenantHeaders(
    NextResponse.next({ request: { headers: requestHeaders } }),
  );
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|csv)$).*)',
  ],
};
