import { NextResponse } from 'next/server';
import {
  aggregateStatus,
  checkCoreEnv,
  checkMongoDb,
  checkSyncApiEnv,
  checkSyncStudentsSample,
  checkThoughtSpotEnv,
  resolveEndpointStatuses,
  statusToHttpCode,
} from '@/lib/healthChecks';

export const dynamic = 'force-dynamic';

/** Readiness probe — MongoDB, env vars, and endpoint readiness (no secrets returned) */
export async function GET() {
  const [mongodb, syncData] = await Promise.all([checkMongoDb(), checkSyncStudentsSample()]);
  const coreEnv = checkCoreEnv();
  const syncApiEnv = checkSyncApiEnv();
  const thoughtspotEnv = checkThoughtSpotEnv();

  const checks = {
    mongodb,
    coreEnv,
    syncApiEnv,
    syncData,
    thoughtspotEnv,
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
        syncTest:
          'GET /api/sync/v1/students?limit=1 with header Authorization: Bearer <SYNC_API_KEY>',
        powerAutomate: '/docs/power-automate-first-manual-test.md',
      },
    },
    { status: httpStatus }
  );
}
