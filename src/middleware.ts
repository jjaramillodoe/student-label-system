import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

function isPublicPath(pathname: string): boolean {
  return (
    pathname.startsWith('/auth') ||
    pathname.startsWith('/student') ||
    pathname.startsWith('/archive') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/students/lookup') ||
    pathname.startsWith('/api/archive') ||
    pathname.startsWith('/api/health') ||
    pathname.startsWith('/api/sync') ||
    pathname.startsWith('/api/cron/')
  );
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  if (isPublicPath(path)) {
    return NextResponse.next();
  }

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    // Do not redirect API callers to the HTML sign-in page (breaks fetch/login flows).
    if (path.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const signInUrl = new URL('/auth/signin', req.url);
    const callback = `${path}${req.nextUrl.search || ''}`;
    if (callback && callback !== '/') {
      signInUrl.searchParams.set('callbackUrl', callback);
    }
    return NextResponse.redirect(signInUrl);
  }

  // Intake Members: keep them on intake / profile / docs / public pages
  if (token.role === 'Intake Member' && !path.startsWith('/api')) {
    const allowed =
      path.startsWith('/intake') ||
      path.startsWith('/profile') ||
      path.startsWith('/docs') ||
      path.startsWith('/student') ||
      path.startsWith('/archive');
    if (!allowed) {
      return NextResponse.redirect(new URL('/intake', req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|csv)$).*)',
  ],
};
