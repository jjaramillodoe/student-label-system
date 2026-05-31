import clientPromise from '@/lib/mongodb';

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface HealthCheckResult {
  ok: boolean;
  latencyMs?: number;
  message?: string;
  details?: Record<string, unknown>;
}

export interface EndpointInfo {
  id: string;
  method: string;
  path: string;
  purpose: string;
  auth: 'none' | 'session' | 'sync-api-key' | 'admin';
  /** Whether dependencies for this route appear configured */
  status: 'ready' | 'misconfigured' | 'unknown';
  statusNote?: string;
}

export const MONITORED_ENDPOINTS: EndpointInfo[] = [
  {
    id: 'health',
    method: 'GET',
    path: '/api/health',
    purpose: 'Liveness probe',
    auth: 'none',
    status: 'ready',
  },
  {
    id: 'health-deep',
    method: 'GET',
    path: '/api/health/deep',
    purpose: 'Readiness + dependency checks',
    auth: 'none',
    status: 'ready',
  },
  {
    id: 'sync-students',
    method: 'GET',
    path: '/api/sync/v1/students',
    purpose: 'Power Automate / Dynamics delta export',
    auth: 'sync-api-key',
    status: 'unknown',
  },
  {
    id: 'students',
    method: 'GET',
    path: '/api/students',
    purpose: 'Student list (NextAuth session)',
    auth: 'session',
    status: 'unknown',
  },
  {
    id: 'dashboard-stats',
    method: 'GET',
    path: '/api/dashboard-stats',
    purpose: 'Dashboard metrics',
    auth: 'session',
    status: 'unknown',
  },
  {
    id: 'print-reports',
    method: 'GET',
    path: '/api/print-reports',
    purpose: 'Print analytics',
    auth: 'session',
    status: 'unknown',
  },
  {
    id: 'thoughtspot-token',
    method: 'GET',
    path: '/api/thoughtspot/token',
    purpose: 'ThoughtSpot embed auth',
    auth: 'session',
    status: 'unknown',
  },
];

function envConfigured(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

export async function checkMongoDb(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const client = await clientPromise;
    await client.db('student-label').command({ ping: 1 });
    return { ok: true, latencyMs: Date.now() - start };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      message: error instanceof Error ? error.message : 'MongoDB ping failed',
    };
  }
}

export function checkCoreEnv(): HealthCheckResult {
  const required = ['MONGODB_URI', 'NEXTAUTH_SECRET', 'NEXTAUTH_URL'];
  const missing = required.filter((name) => !envConfigured(name));

  if (missing.length === 0) {
    return { ok: true, details: { checked: required } };
  }

  return {
    ok: false,
    message: `Missing environment variables: ${missing.join(', ')}`,
    details: { missing, checked: required },
  };
}

export function checkSyncApiEnv(): HealthCheckResult {
  const configured = envConfigured('SYNC_API_KEY');
  return {
    ok: configured,
    message: configured ? undefined : 'SYNC_API_KEY is not set',
    details: { configured },
  };
}

export function checkThoughtSpotEnv(): HealthCheckResult {
  const host = envConfigured('THOUGHTSPOT_HOST') || envConfigured('NEXT_PUBLIC_THOUGHTSPOT_HOST');
  const secret = envConfigured('THOUGHTSPOT_SECRET_KEY');
  const liveboard = envConfigured('THOUGHTSPOT_ENROLLMENT_LIVEBOARD_ID');

  const configured = host && secret && liveboard;
  return {
    ok: Boolean(configured),
    details: {
      host,
      secretKey: secret,
      liveboardId: liveboard,
      configured: Boolean(configured),
    },
    message: configured ? undefined : 'ThoughtSpot embed is not fully configured',
  };
}

export async function checkSyncStudentsSample(): Promise<HealthCheckResult> {
  if (!envConfigured('SYNC_API_KEY')) {
    return { ok: false, message: 'SYNC_API_KEY not configured' };
  }

  const start = Date.now();
  try {
    const client = await clientPromise;
    const count = await client.db('student-label').collection('students').estimatedDocumentCount();

    return {
      ok: true,
      latencyMs: Date.now() - start,
      details: { studentsCollectionReachable: true, estimatedStudents: count },
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      message: error instanceof Error ? error.message : 'Sync data check failed',
    };
  }
}

export function resolveEndpointStatuses(
  checks: Record<string, HealthCheckResult>
): EndpointInfo[] {
  return MONITORED_ENDPOINTS.map((endpoint) => {
    if (endpoint.id === 'sync-students') {
      const syncOk = checks.syncApiEnv?.ok && checks.syncData?.ok;
      return {
        ...endpoint,
        status: syncOk ? 'ready' : 'misconfigured',
        statusNote: syncOk
          ? 'Bearer SYNC_API_KEY required to call'
          : checks.syncApiEnv?.message || checks.syncData?.message,
      };
    }

    if (endpoint.id === 'thoughtspot-token') {
      const ts = checks.thoughtspotEnv;
      return {
        ...endpoint,
        status: ts?.ok ? 'ready' : 'misconfigured',
        statusNote: ts?.ok ? 'NextAuth session required' : ts?.message,
      };
    }

    if (endpoint.auth === 'session' || endpoint.auth === 'admin') {
      const coreOk = checks.coreEnv?.ok && checks.mongodb?.ok;
      return {
        ...endpoint,
        status: coreOk ? 'ready' : 'misconfigured',
        statusNote: coreOk ? 'NextAuth session required' : 'Core dependencies unhealthy',
      };
    }

    return endpoint;
  });
}

export function aggregateStatus(checks: {
  mongodb: HealthCheckResult;
  coreEnv: HealthCheckResult;
  syncApiEnv: HealthCheckResult;
  syncData: HealthCheckResult;
  thoughtspotEnv: HealthCheckResult;
}): HealthStatus {
  const required = [checks.mongodb, checks.coreEnv, checks.syncApiEnv, checks.syncData];
  const requiredFailed = required.filter((c) => !c.ok).length;

  if (requiredFailed > 0) {
    return requiredFailed === required.length ? 'unhealthy' : 'degraded';
  }
  if (!checks.thoughtspotEnv.ok) return 'degraded';
  return 'healthy';
}

export function statusToHttpCode(status: HealthStatus): number {
  if (status === 'healthy') return 200;
  if (status === 'degraded') return 200;
  return 503;
}
