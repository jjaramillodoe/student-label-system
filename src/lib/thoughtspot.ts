export function getThoughtSpotHost(): string | undefined {
  return process.env.THOUGHTSPOT_HOST?.replace(/\/$/, '');
}

export function getThoughtSpotSecretKey(): string | undefined {
  return process.env.THOUGHTSPOT_SECRET_KEY;
}

export function getThoughtSpotLiveboardId(): string | undefined {
  return process.env.THOUGHTSPOT_ENROLLMENT_LIVEBOARD_ID;
}

export function isThoughtSpotConfigured(): boolean {
  return Boolean(
    getThoughtSpotHost() &&
      getThoughtSpotSecretKey() &&
      getThoughtSpotLiveboardId()
  );
}

type ThoughtSpotGroup = 'District79-Admins' | 'District79-DataLeads' | 'District79-Staff';

export function thoughtSpotGroupForRole(role?: string): ThoughtSpotGroup {
  if (role === 'Admin') return 'District79-Admins';
  if (role === 'Data Lead') return 'District79-DataLeads';
  return 'District79-Staff';
}

export interface ThoughtSpotTokenRequest {
  username: string;
  secret_key: string;
  auto_create: boolean;
  display_name?: string;
  email?: string;
  group_identifiers: string[];
  validity_time_in_sec: number;
}

export interface ThoughtSpotTokenResponse {
  token: string;
}

export async function fetchThoughtSpotFullAccessToken(
  host: string,
  body: ThoughtSpotTokenRequest
): Promise<string> {
  const response = await fetch(`${host}/api/rest/2.0/auth/token/full`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`ThoughtSpot token request failed (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as ThoughtSpotTokenResponse;
  if (!data.token) {
    throw new Error('ThoughtSpot token response did not include a token');
  }

  return data.token;
}
