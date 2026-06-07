import {
  extractAddressUnit,
  normalizeAptField,
  normalizeStudentAddress,
  validateStudentAddress,
  type StudentAddressInput,
  type NormalizedStudentAddress,
} from '@/lib/addressValidation';
import {
  boroughForGeoclient,
  formatGeoclientBorough,
  formatGeoclientStreet,
  geoclientLookup,
  isGeoclientConfigured,
  parseStreetForGeoclient,
  type GeoclientAddressResult,
} from '@/lib/nycGeoclient';

export interface AddressGeoclientVerification {
  status: 'verified' | 'warning' | 'not_found' | 'error' | 'skipped' | 'empty';
  normalized: NormalizedStudentAddress;
  standardized?: NormalizedStudentAddress;
  warnings: string[];
  flags: string[];
  geoclient?: {
    returnCode?: string;
    returnCode2?: string;
    message?: string;
    latitude?: number;
    longitude?: number;
    bbl?: string;
    bin?: string;
  };
}

function compareZip(a?: string, b?: string): boolean {
  const za = (a || '').replace(/\D/g, '').slice(0, 5);
  const zb = (b || '').replace(/\D/g, '').slice(0, 5);
  return za.length === 5 && zb.length === 5 && za === zb;
}

function buildFromGeoclient(
  input: StudentAddressInput,
  result: GeoclientAddressResult,
): NormalizedStudentAddress {
  const normalized = normalizeStudentAddress(input);
  const streetCore = formatGeoclientStreet(result.houseNumber, result.streetName) || normalized.address;
  const apt = normalized.apt
    || normalizeAptField(extractAddressUnit(String(input.address ?? '')).unit || '');
  const city = formatGeoclientBorough(result.boroughName) || normalized.city;
  const zip = result.zipCode || normalized.zip;
  return normalizeStudentAddress({
    address: streetCore,
    apt,
    city,
    state: 'NY',
    zip,
  });
}

export async function verifyAddressWithGeoclient(
  input: StudentAddressInput,
): Promise<AddressGeoclientVerification> {
  const local = validateStudentAddress(input);
  const normalized = local.normalized;

  if (local.status === 'empty') {
    return {
      status: 'empty',
      normalized,
      warnings: [],
      flags: [],
    };
  }

  if (!isGeoclientConfigured()) {
    return {
      status: 'error',
      normalized,
      warnings: ['NYC Geoclient API keys are not configured on the server.'],
      flags: ['geoclient_not_configured'],
    };
  }

  const parsed = parseStreetForGeoclient(normalized.address);
  const borough = boroughForGeoclient(normalized.city, normalized.zip);

  const result = await geoclientLookup({
    houseNumber: parsed.houseNumber,
    street: parsed.street,
    borough,
    zip: borough ? undefined : normalized.zip,
  });

  if (!result.ok) {
    return {
      status: 'not_found',
      normalized,
      warnings: [
        result.message || 'NYC Geoclient could not verify this address.',
        ...local.warnings.map(w => `Local: ${w}`),
      ],
      flags: ['geoclient_not_found', ...local.flags],
      geoclient: {
        returnCode: result.geosupportReturnCode,
        returnCode2: result.geosupportReturnCode2,
        message: result.message,
      },
    };
  }

  const standardized = buildFromGeoclient(input, result);
  const warnings: string[] = [];
  const flags: string[] = [];

  if (result.warning) {
    warnings.push('Geoclient matched with warnings — review standardized address.');
    flags.push('geoclient_warning');
  }

  if (standardized.zip && normalized.zip && !compareZip(standardized.zip, normalized.zip)) {
    warnings.push(`ZIP corrected: ${normalized.zip} → ${standardized.zip}`);
    flags.push('zip_corrected');
  }

  if (
    standardized.city
    && normalized.city
    && standardized.city.toLowerCase() !== normalized.city.toLowerCase()
  ) {
    warnings.push(`City/borough corrected: ${normalized.city} → ${standardized.city}`);
    flags.push('city_corrected');
  }

  const stdStreet = standardized.address.toLowerCase();
  const inStreet = normalized.address.toLowerCase();
  if (stdStreet && inStreet && stdStreet !== inStreet) {
    warnings.push('Street standardized by NYC Geoclient');
    flags.push('street_standardized');
  }

  warnings.push(...local.warnings.filter(w => !warnings.some(x => x.includes(w))));

  return {
    status: result.warning || flags.includes('zip_corrected') || flags.includes('city_corrected')
      ? 'warning'
      : 'verified',
    normalized,
    standardized,
    warnings,
    flags: [...new Set([...flags, ...local.flags.filter(f => !f.startsWith('geoclient'))])],
    geoclient: {
      returnCode: result.geosupportReturnCode,
      returnCode2: result.geosupportReturnCode2,
      message: result.message,
      latitude: result.latitude,
      longitude: result.longitude,
      bbl: result.bbl,
      bin: result.buildingIdentificationNumber,
    },
  };
}

export async function verifyAddressesBatch(
  items: Array<{ key: string | number; input: StudentAddressInput }>,
  options?: { delayMs?: number },
): Promise<Map<string | number, AddressGeoclientVerification>> {
  const delayMs = options?.delayMs ?? 120;
  const results = new Map<string | number, AddressGeoclientVerification>();

  for (const item of items) {
    results.set(item.key, await verifyAddressWithGeoclient(item.input));
    if (delayMs > 0) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  return results;
}
