import { extractAddressUnit } from '@/lib/addressValidation';

/**
 * NYC Geoclient API client (api.nyc.gov geoclient v2).
 *
 * Current NYC API portal auth uses a subscription key header:
 *   Ocp-Apim-Subscription-Key: <key>
 *
 * Set NYC_GEOCLIENT_SUBSCRIPTION_KEY (or NYC_GEOCLIENT_APP_KEY as alias).
 * APP_ID is not required for v2.
 *
 * Legacy v1 (app_id + app_key query params) is still supported when
 * NYC_GEOCLIENT_BASE_URL points at /v1 or NYC_GEOCLIENT_USE_V1=true.
 */

export interface GeoclientAddressInput {
  houseNumber: string;
  street: string;
  borough?: string;
  zip?: string;
}

export interface GeoclientAddressResult {
  ok: boolean;
  verified: boolean;
  warning: boolean;
  houseNumber?: string;
  streetName?: string;
  boroughName?: string;
  zipCode?: string;
  latitude?: number;
  longitude?: number;
  bbl?: string;
  buildingIdentificationNumber?: string;
  geosupportReturnCode?: string;
  geosupportReturnCode2?: string;
  reasonCode?: string;
  message?: string;
  raw?: Record<string, unknown>;
}

const DEFAULT_BASE_V2 = 'https://api.nyc.gov/geoclient/v2';
const DEFAULT_BASE_V1 = 'https://api.nyc.gov/geoclient/v1';

type GeoclientAuth =
  | { mode: 'subscription'; subscriptionKey: string }
  | { mode: 'legacy'; appId: string; appKey: string };

function getSubscriptionKey(): string | null {
  const key = (
    process.env.NYC_GEOCLIENT_SUBSCRIPTION_KEY
    || process.env.NYC_GEOCLIENT_APP_KEY
  )?.trim();
  return key || null;
}

function useLegacyV1(): boolean {
  if (process.env.NYC_GEOCLIENT_USE_V1 === 'true') return true;
  const base = (process.env.NYC_GEOCLIENT_BASE_URL || '').toLowerCase();
  return base.includes('/geoclient/v1');
}

function getCredentials(): GeoclientAuth | null {
  const subscriptionKey = getSubscriptionKey();
  const appId = process.env.NYC_GEOCLIENT_APP_ID?.trim();
  const appKey = process.env.NYC_GEOCLIENT_APP_KEY?.trim();

  if (useLegacyV1()) {
    if (!appId || !appKey) return null;
    return { mode: 'legacy', appId, appKey };
  }

  if (subscriptionKey) {
    return { mode: 'subscription', subscriptionKey };
  }

  return null;
}

export function isGeoclientConfigured(): boolean {
  return getCredentials() !== null;
}

/** Strip unit/apt for Geosupport street lookup. */
export function parseStreetForGeoclient(addressLine: string): { houseNumber: string; street: string } {
  let line = extractAddressUnit(addressLine).base.trim().replace(/\s+/g, ' ');

  const queens = line.match(/^(\d{1,3}-\d{1,4})\s+(.+)$/i);
  if (queens) {
    return { houseNumber: queens[1], street: queens[2].trim() };
  }

  const standard = line.match(/^(\d+[A-Z]?)\s+(.+)$/i);
  if (standard) {
    return { houseNumber: standard[1], street: standard[2].trim() };
  }

  return { houseNumber: '', street: line };
}

export function boroughForGeoclient(city: string, zip?: string): string | undefined {
  const key = city.trim().toLowerCase();
  const map: Record<string, string> = {
    brooklyn: 'Brooklyn',
    queens: 'Queens',
    jamaica: 'Queens',
    'new york': 'Manhattan',
    manhattan: 'Manhattan',
    bronx: 'Bronx',
    'staten island': 'Staten Island',
  };
  if (map[key]) return map[key];

  const prefix = zip?.replace(/\D/g, '').slice(0, 3);
  if (prefix === '112') return 'Brooklyn';
  if (['113', '114', '116'].includes(prefix || '')) return 'Queens';
  if (['100', '101', '102'].includes(prefix || '')) return 'Manhattan';
  if (prefix === '104') return 'Bronx';
  if (prefix === '103') return 'Staten Island';
  return undefined;
}

function isSuccessCode(code?: string): boolean {
  return code === '00' || code === '01';
}

function parseGeoclientPayload(data: Record<string, unknown>): GeoclientAddressResult {
  const address = (data.address ?? data) as Record<string, unknown>;
  const rc = String(address.geosupportReturnCode ?? '');
  const rc2 = String(address.geosupportReturnCode2 ?? '');
  const verified = isSuccessCode(rc2) || isSuccessCode(rc);
  const warning = rc === '01' || rc2 === '01';
  const hasLocation = Boolean(address.houseNumber || address.firstStreetNameNormalized || address.zipCode);

  return {
    ok: verified && hasLocation,
    verified,
    warning,
    houseNumber: String(address.houseNumber ?? address.houseNumberIn ?? '').trim() || undefined,
    streetName: String(
      address.firstStreetNameNormalized
      ?? address.boePreferredStreetName
      ?? address.giStreetName1
      ?? '',
    ).trim() || undefined,
    boroughName: String(address.firstBoroughName ?? '').trim() || undefined,
    zipCode: String(address.zipCode ?? '').trim().slice(0, 5) || undefined,
    latitude: typeof address.latitude === 'number' ? address.latitude : undefined,
    longitude: typeof address.longitude === 'number' ? address.longitude : undefined,
    bbl: String(address.bbl ?? '').trim() || undefined,
    buildingIdentificationNumber: String(address.buildingIdentificationNumber ?? '').trim() || undefined,
    geosupportReturnCode: rc || undefined,
    geosupportReturnCode2: rc2 || undefined,
    reasonCode: String(address.reasonCode ?? address.reasonCode2 ?? '').trim() || undefined,
    message: String(address.message ?? '').trim() || undefined,
    raw: address,
  };
}

function getBaseUrl(creds: GeoclientAuth): string {
  const configured = process.env.NYC_GEOCLIENT_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  return creds.mode === 'legacy' ? DEFAULT_BASE_V1 : DEFAULT_BASE_V2;
}

export async function geoclientLookup(input: GeoclientAddressInput): Promise<GeoclientAddressResult> {
  const creds = getCredentials();
  if (!creds) {
    return {
      ok: false,
      verified: false,
      warning: false,
      message: 'NYC Geoclient is not configured (set NYC_GEOCLIENT_SUBSCRIPTION_KEY or NYC_GEOCLIENT_APP_KEY).',
    };
  }

  if (!input.houseNumber?.trim() || !input.street?.trim()) {
    return {
      ok: false,
      verified: false,
      warning: false,
      message: 'Could not parse house number and street from the address line.',
    };
  }

  const base = getBaseUrl(creds);
  const params = new URLSearchParams({
    houseNumber: input.houseNumber.trim(),
    street: input.street.trim(),
  });

  if (input.borough?.trim()) {
    params.set('borough', input.borough.trim());
  } else if (input.zip?.trim()) {
    params.set('zip', input.zip.trim().slice(0, 5));
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Cache-Control': 'no-cache',
  };

  let path = '/address';

  if (creds.mode === 'subscription') {
    headers['Ocp-Apim-Subscription-Key'] = creds.subscriptionKey;
  } else {
    params.set('app_id', creds.appId);
    params.set('app_key', creds.appKey);
    path = '/address.json';
  }

  const url = `${base}${path}?${params.toString()}`;

  try {
    const res = await fetch(url, {
      headers,
      cache: 'no-store',
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return {
        ok: false,
        verified: false,
        warning: false,
        message: `Geoclient HTTP ${res.status}${text ? `: ${text.slice(0, 120)}` : ''}`,
      };
    }

    const data = await res.json() as Record<string, unknown>;
    const parsed = parseGeoclientPayload(data);
    if (!parsed.ok) {
      return {
        ...parsed,
        message: parsed.message || `Geoclient could not verify address (code ${parsed.geosupportReturnCode2 || parsed.geosupportReturnCode || 'unknown'}).`,
      };
    }
    return parsed;
  } catch (err) {
    return {
      ok: false,
      verified: false,
      warning: false,
      message: err instanceof Error ? err.message : 'Geoclient request failed',
    };
  }
}

export function formatGeoclientStreet(houseNumber?: string, streetName?: string): string {
  if (!houseNumber && !streetName) return '';
  if (!houseNumber) return streetName || '';
  if (!streetName) return houseNumber;
  return `${houseNumber} ${streetName}`.trim();
}

export function formatGeoclientBorough(boroughName?: string): string {
  if (!boroughName) return '';
  const b = boroughName.trim().toLowerCase();
  if (b === 'manhattan') return 'New York';
  if (b === 'brooklyn') return 'Brooklyn';
  if (b === 'queens') return 'Queens';
  if (b === 'bronx') return 'Bronx';
  if (b === 'staten island') return 'Staten Island';
  return boroughName;
}
