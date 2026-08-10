import NextAuth from 'next-auth';
import type { NextRequest } from 'next/server';
import { authOptions } from '@/lib/authOptions';
import { authRequestStore } from '@/lib/authRequestContext';

const handler = NextAuth(authOptions);

type RouteCtx = { params: Promise<{ nextauth: string[] }> };

async function withAuthRequest(
  req: NextRequest,
  ctx: RouteCtx,
  method: 'GET' | 'POST',
) {
  return authRequestStore.run(req, () => {
    if (method === 'GET') return handler(req, ctx);
    return handler(req, ctx);
  });
}

export async function GET(req: NextRequest, ctx: RouteCtx) {
  return withAuthRequest(req, ctx, 'GET');
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  return withAuthRequest(req, ctx, 'POST');
}
