import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

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

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // Intake Members only use Intake (+ profile / public / auth / their APIs)
    if (token?.role === 'Intake Member' && !path.startsWith('/api')) {
      const allowed =
        path.startsWith('/intake') ||
        path.startsWith('/profile') ||
        path.startsWith('/auth') ||
        path.startsWith('/docs') ||
        path.startsWith('/student') ||
        path.startsWith('/archive');
      if (!allowed) {
        return NextResponse.redirect(new URL('/intake', req.url));
      }
    }

    return NextResponse.next();
  },
  {
    pages: { signIn: '/auth/signin' },
    callbacks: {
      authorized: ({ token, req }) => {
        if (isPublicPath(req.nextUrl.pathname)) return true;
        return !!token;
      },
    },
  },
);

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|csv)$).*)',
  ],
};
