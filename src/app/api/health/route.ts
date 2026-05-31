import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Public liveness — safe for browsers, uptime monitors, and Power Automate ping tests */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'student-label-system',
    timestamp: new Date().toISOString(),
    links: {
      deep: '/api/health/deep',
      docs: '/docs',
      sync: '/api/sync/v1/students',
    },
  });
}
