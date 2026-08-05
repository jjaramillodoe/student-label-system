import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import {
  fetchThoughtSpotFullAccessToken,
  getThoughtSpotHost,
  getThoughtSpotSecretKey,
  isThoughtSpotConfigured,
  thoughtSpotGroupForRole,
} from '@/lib/thoughtspot';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = (session.user as { role?: string }).role;
  if (role !== 'Admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!isThoughtSpotConfigured()) {
    return NextResponse.json(
      {
        error: 'ThoughtSpot is not configured',
        requiredEnv: [
          'THOUGHTSPOT_HOST',
          'THOUGHTSPOT_SECRET_KEY',
          'THOUGHTSPOT_ENROLLMENT_LIVEBOARD_ID',
        ],
      },
      { status: 503 }
    );
  }

  const host = getThoughtSpotHost()!;
  const secretKey = getThoughtSpotSecretKey()!;
  const user = session.user as { email: string; name?: string; role?: string };

  try {
    const token = await fetchThoughtSpotFullAccessToken(host, {
      username: user.email,
      secret_key: secretKey,
      auto_create: true,
      display_name: user.name,
      email: user.email,
      group_identifiers: [thoughtSpotGroupForRole(user.role)],
      validity_time_in_sec: 300,
    });

    return new NextResponse(token, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  } catch (error) {
    console.error('ThoughtSpot token error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create ThoughtSpot token' },
      { status: 502 }
    );
  }
}
