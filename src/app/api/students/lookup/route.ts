import { NextRequest, NextResponse } from 'next/server';
import { loadPublicStudentLookup } from '@/lib/loadPublicStudent';
import {
  LOOKUP_RATE,
  clientIp,
  consumeRateLimit,
  rateLimitResponse,
} from '@/lib/rateLimit';

/**
 * GET /api/students/lookup?studentId=1979-EC-0000048
 *
 * Public endpoint — no authentication required.
 * The student ID embedded in the QR URL is the access key.
 * Returns a field-whitelisted payload for the public student page and cabinet locate scan.
 */
export async function GET(req: NextRequest) {
  try {
    const limited = consumeRateLimit({
      key: `lookup:${clientIp(req)}`,
      ...LOOKUP_RATE,
    });
    if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

    const studentId = req.nextUrl.searchParams.get('studentId');
    if (!studentId) {
      return NextResponse.json({ error: 'studentId query param required' }, { status: 400 });
    }

    const student = await loadPublicStudentLookup(studentId);
    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    return NextResponse.json(student);
  } catch (error) {
    console.error('Error looking up student:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
