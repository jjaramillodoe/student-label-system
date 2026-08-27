import { NextRequest, NextResponse } from 'next/server';
import {
  aggregateStatus,
  checkCoreEnv,
  checkMongoDb,
  checkSyncApiEnv,
  checkSyncStudentsSample,
  checkMotherDuckEnv,
  resolveEndpointStatuses,
  statusToHttpCode,
} from '@/lib/healthChecks';
import { isAuthorizedBySharedSecret } from '@/lib/secretCompare';
import { requireSession } from '@/lib/requireSession';

export const dynamic = 'force-dynamic';

async function isDeepHealthAuthorized(req: NextRequest): Promise<boolean> {
  const probeSecret = process.env.HEALTH_PROBE_SECRET || process.env.CRON_SECRET;
  if (isAuthorizedBySharedSecret(req.headers.get('authorization'), probeSecret)) {
    return true;
  }
  const auth = await requireSession();
  return auth.ok && auth.user.role === 'Admin';
}

/** Readiness probe — Admin session or Bearer HEALTH_PROBE_SECRET / CRON_SECRET */
export async function GET(req: NextRequest) {
  if (!(await isDeepHealthAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [mongodb, syncData] = await Promise.all([checkMongoDb(), checkSyncStudentsSample()]);
  const coreEnv = checkCoreEnv();
  const syncApiEnv = checkSyncApiEnv();
  const motherduckEnv = checkMotherDuckEnv();

  const checks = {
    mongodb,
    coreEnv,
    syncApiEnv,
    syncData,
    motherduckEnv,
  };

  const endpoints = resolveEndpointStatuses(checks);
  const status = aggregateStatus(checks);
  const httpStatus = statusToHttpCode(status);

  return NextResponse.json(
    {
      status,
      service: 'student-label-system',
      timestamp: new Date().toISOString(),
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
      checks: Object.fromEntries(
        Object.entries(checks).map(([key, value]) => [
          key,
          {
            ok: value.ok,
            latencyMs: value.latencyMs,
            message: value.message,
            details: value.details,
          },
        ])
      ),
      endpoints,
      hints: {
        liveness: 'GET /api/health',
        powerAutomate: '/docs/power-automate-first-manual-test.md',
        motherduck: 'Admin → MotherDuck · set MOTHERDUCK_TOKEN then Sync from MongoDB',
      },
    },
    { status: httpStatus }
  );
}
