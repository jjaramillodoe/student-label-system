import { NextRequest } from 'next/server';

type AuthResult =
  | { ok: true }
  | { ok: false; error: string; status: 401 | 503 };

export function validateSyncAuth(req: NextRequest): AuthResult {
  const apiKey = process.env.SYNC_API_KEY;
  if (!apiKey) {
    return { ok: false, error: 'Sync API is not configured', status: 503 };
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, error: 'Unauthorized', status: 401 };
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (token !== apiKey) {
    return { ok: false, error: 'Unauthorized', status: 401 };
  }

  return { ok: true };
}
