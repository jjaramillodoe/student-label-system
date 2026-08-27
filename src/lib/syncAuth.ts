import { NextRequest } from 'next/server';
import { isAuthorizedBySharedSecret } from '@/lib/secretCompare';

type AuthResult =
  | { ok: true }
  | { ok: false; error: string; status: 401 | 503 };

export function validateSyncAuth(req: NextRequest): AuthResult {
  const apiKey = process.env.SYNC_API_KEY;
  if (!apiKey) {
    return { ok: false, error: 'Sync API is not configured', status: 503 };
  }

  if (!isAuthorizedBySharedSecret(req.headers.get('authorization'), apiKey)) {
    return { ok: false, error: 'Unauthorized', status: 401 };
  }

  return { ok: true };
}
