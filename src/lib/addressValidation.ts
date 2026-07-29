/**
 * Local US/NYC address validation and light normalization.
 * Import stores raw values; warnings flag likely errors without blocking upload.
 * NYC Geoclient standardization is available via intake, bulk upload, and
 * Admin → All Students (batch verify of up to 50 unverified addresses at a time).
 */

export interface StudentAddressInput {
  address?: string;
  apt?: string;
  city?: string;
  state?: string;
  zip?: string;
}

export interface NormalizedStudentAddress {
  address: string;
  apt: string;
  city: string;
  state: string;
  zip: string;
}

export interface AddressValidationResult {
  normalized: NormalizedStudentAddress;
  warnings: string[];
  flags: string[];
  status: 'empty' | 'ok' | 'warning';
  borough: string | null;
}

const NYC_CITY_ALIASES: Record<string, string> = {
  'new york': 'New York',
  'new york city': 'New York',
  'manhattan': 'New York',
  'nyc': 'New York',
  brooklyn: 'Brooklyn',
  queens: 'Queens',
  jamaica: 'Jamaica',
  bronx: 'Bronx',
  'staten island': 'Staten Island',
};

/** Borough inferred from ZIP prefix (NYC-focused). */
export function boroughFromZip(zip: string): string | null {
  const digits = zip.replace(/\D/g, '').slice(0, 5);
  if (digits.length < 3) return null;
  const prefix = digits.slice(0, 3);
  if (['100', '101', '102'].includes(prefix)) return 'Manhattan';
  if (prefix === '103') return 'Staten Island';
  if (prefix === '104') return 'Bronx';
  if (prefix === '112') return 'Brooklyn';
  if (['113', '114', '116'].includes(prefix)) return 'Queens';
  return null;
}

function titleCaseCity(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

const STREET_SUFFIX_ABBREV: Record<string, string> = {
  st: 'St',
  street: 'St',
  ave: 'Ave',
  av: 'Ave',
  avenue: 'Ave',
  rd: 'Rd',
  road: 'Rd',
  blvd: 'Blvd',
  boulevard: 'Blvd',
  ln: 'Ln',
  lane: 'Ln',
  dr: 'Dr',
  drive: 'Dr',
  ct: 'Ct',
  court: 'Ct',
  pl: 'Pl',
  place: 'Pl',
  ter: 'Ter',
  terrace: 'Ter',
  pkwy: 'Pkwy',
  parkway: 'Pkwy',
  cir: 'Cir',
  circle: 'Cir',
  hwy: 'Hwy',
  highway: 'Hwy',
};

const STREET_DIRECTIONALS = new Set(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']);

function formatStreetToken(token: string): string {
  if (!token) return token;

  if (/^\d{1,3}-\d{1,4}$/.test(token)) return token;

  if (/^\d+[A-Za-z]?$/.test(token)) {
    return token.replace(/([a-z])$/i, letter => letter.toUpperCase());
  }

  if (token.startsWith('#')) {
    const inner = token.slice(1);
    if (!inner) return '#';
    return `#${inner.charAt(0).toUpperCase()}${inner.slice(1).toLowerCase()}`;
  }

  const bare = token.toLowerCase().replace(/\./g, '');
  if (bare === 'apt' || bare === 'apartment') return 'Apt';
  if (bare === 'unit') return 'Unit';
  if (bare === 'ste' || bare === 'suite') return 'Ste';
  if (bare === 'fl' || bare === 'floor') return 'Fl';
  if (STREET_DIRECTIONALS.has(bare)) return bare.toUpperCase();
  if (STREET_SUFFIX_ABBREV[bare]) return STREET_SUFFIX_ABBREV[bare];

  const ordinal = token.match(/^(\d+)(st|nd|rd|th)$/i);
  if (ordinal) return `${ordinal[1]}${ordinal[2].toLowerCase()}`;

  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

function titleCaseStreetLine(line: string): string {
  return line.split(/\s+/).filter(Boolean).map(formatStreetToken).join(' ');
}

const UNIT_SUFFIX_RE =
  /\s+((?:Apt|Apartment|Unit|Ste|Suite|Fl|Floor)\s*\.?\s*#?[\w-]+|#\s*[\w-]+)\s*$/i;

function formatUnitLabel(raw: string): string {
  const t = raw.trim().replace(/\s+/g, ' ');
  if (!t) return '';
  if (/^#\s*[\w-]+$/i.test(t)) return t.replace(/^#\s*/i, '#');
  if (/^(apartment|apt)\s*/i.test(t)) {
    return `Apt ${t.replace(/^(apartment|apt)\s*\.?\s*/i, '')}`;
  }
  if (/^unit\s*/i.test(t)) return `Unit ${t.replace(/^unit\s*\.?\s*/i, '')}`;
  if (/^(ste|suite)\s*/i.test(t)) return `Ste ${t.replace(/^(ste|suite)\s*\.?\s*/i, '')}`;
  if (/^(fl|floor)\s*/i.test(t)) return `Fl ${t.replace(/^(fl|floor)\s*\.?\s*/i, '')}`;
  if (/^(apt|unit|ste|fl|#)/i.test(t)) return titleCaseStreetLine(t);
  return `Apt ${t}`;
}

/** Normalize apt/unit for storage in the dedicated `apt` column (e.g. "4B", "#2"). */
export function normalizeAptField(raw: string): string {
  if (!raw?.trim()) return '';
  const formatted = formatUnitLabel(raw.trim());
  if (formatted.startsWith('#')) return formatted;
  const stripped = formatted.replace(/^(Apt|Unit|Ste|Fl)\s+/i, '').trim();
  return stripped || formatted;
}

/** Display apt in stacked address lines (e.g. "4B" → "Apt 4B"). */
export function formatAptDisplay(apt: string): string {
  const n = normalizeAptField(apt);
  if (!n) return '';
  if (n.startsWith('#')) return n;
  if (/^(Apt|Unit|Ste|Fl)\s/i.test(n)) return n;
  return `Apt ${n}`;
}

/** Split a street line into building address and unit/apt (if present). */
export function extractAddressUnit(addressLine: string): { base: string; unit: string | null } {
  let line = addressLine.trim().replace(/\s+/g, ' ');
  if (!line) return { base: '', unit: null };

  if (line.includes(',')) {
    line = line.split(',')[0].trim();
  }

  const m = line.match(UNIT_SUFFIX_RE);
  if (m) {
    return {
      base: line.slice(0, m.index).trim(),
      unit: formatUnitLabel(m[1]),
    };
  }
  return { base: line, unit: null };
}

/** Append a unit to a street line when Geoclient or imports only have the building address. */
export function appendUnitToAddress(
  street: string,
  unit: string | null | undefined,
): string {
  const base = street.trim();
  const rawUnit = (unit || '').trim();
  if (!base) return rawUnit ? formatUnitLabel(rawUnit) : '';
  if (!rawUnit) return normalizeStreetLine(base);

  const formatted = formatUnitLabel(rawUnit);
  const baseLower = base.toLowerCase();
  const unitLower = formatted.toLowerCase();
  if (baseLower.includes(unitLower)) return normalizeStreetLine(base);

  return normalizeStreetLine(`${base} ${formatted}`);
}

function normalizeStreetLine(value: string): string {
  const cleaned = value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\bAPT\.?\s*/gi, 'Apt ')
    .replace(/\bAPARTMENT\s*/gi, 'Apt ')
    .replace(/\bUNIT\.?\s*/gi, 'Unit ')
    // Only match Ste/Suite when followed by a unit number — avoids breaking "Sterling"
    .replace(/\bSTE\.?\s+(?=#|\d)/gi, 'Ste ')
    .replace(/\bSTE\.?\s*#\s*/gi, 'Ste #')
    .replace(/\bSUITE\s+(?=#|\d)/gi, 'Ste ')
    .replace(/\bFL\.?\s+(?=#|\d)/gi, 'Fl ')
    .replace(/\bAVE\.?\b/gi, 'Ave')
    .replace(/\bAVENUE\b/gi, 'Ave')
    .replace(/\bST\.?\b/gi, 'St')
    .replace(/\bSTREET\b/gi, 'St')
    .replace(/\bROAD\b/gi, 'Rd')
    .replace(/\bBOULEVARD\b/gi, 'Blvd')
    .replace(/\bDRIVE\b/gi, 'Dr')
    .replace(/\bLANE\b/gi, 'Ln')
    .replace(/\bPLACE\b/gi, 'Pl')
    .replace(/#\s*/g, '#')
    .replace(/,\s*#/g, ' #');

  return titleCaseStreetLine(cleaned);
}

function normalizeZip(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length >= 5) return digits.slice(0, 5);
  return digits;
}

function expectedBoroughsForCity(city: string): string[] {
  const key = city.toLowerCase();
  if (key === 'brooklyn') return ['Brooklyn'];
  if (key === 'queens' || key === 'jamaica') return ['Queens'];
  if (key === 'bronx') return ['Bronx'];
  if (key === 'staten island') return ['Staten Island'];
  if (key === 'new york') return ['Manhattan'];
  return [];
}

function hasQueensStyleAddress(address: string): boolean {
  return /\d{1,3}-\d{2,3}\s/.test(address) || /\b\d{5}\s+\d{2}(ST|ND|RD|TH)\b/i.test(address);
}

/**
 * Parse a pasted one-line address into separate fields.
 * e.g. "1281 Sterling Pl, Brooklyn, NY 11213"
 */
export function parsePastedAddress(text: string): StudentAddressInput | null {
  const raw = text.trim().replace(/\s+/g, ' ');
  if (!raw) return null;

  const parts = raw.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;

  const unitSegmentRe = /^(apt|apartment|unit|ste|suite|fl|floor|#)/i;
  let street = parts[0];
  let apt = '';
  let city = '';
  let state = 'NY';
  let zip = '';
  let offset = 1;

  if (parts.length >= 3 && unitSegmentRe.test(parts[1])) {
    apt = parts[1];
    offset = 2;
  }

  const stateZipRe = /^([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i;
  const cityStateZipRe = /^(.+?)\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i;

  if (parts.length - offset === 1) {
    const tail = parts[offset];
    const csz = tail.match(cityStateZipRe);
    if (csz) {
      city = csz[1].trim();
      state = csz[2].toUpperCase();
      zip = csz[3];
    } else {
      city = tail;
    }
  } else if (parts.length - offset >= 2) {
    city = parts[parts.length - 2];
    const stateZipPart = parts[parts.length - 1];
    const sz = stateZipPart.match(stateZipRe);
    if (sz) {
      state = sz[1].toUpperCase();
      zip = sz[2];
    } else {
      const csz = stateZipPart.match(cityStateZipRe);
      if (csz) {
        city = csz[1].trim();
        state = csz[2].toUpperCase();
        zip = csz[3];
      }
    }
  }

  return normalizeStudentAddress({ address: street, apt, city, state, zip });
}

/** Street on one line; city/state/ZIP on the next — for table display. */
export function formatStudentAddressStacked(input: StudentAddressInput): {
  streetLine: string;
  cityStateZip: string;
} | null {
  const normalized = normalizeStudentAddress(input);
  if (!normalized.address && !normalized.apt && !normalized.city && !normalized.state && !normalized.zip) {
    return null;
  }

  const cityStateZip = [
    normalized.city,
    [normalized.state, normalized.zip].filter(Boolean).join(' '),
  ].filter(Boolean).join(', ');

  const aptDisplay = formatAptDisplay(normalized.apt);
  const streetLine = [normalized.address, aptDisplay].filter(Boolean).join(' ');

  return {
    streetLine,
    cityStateZip,
  };
}

export function normalizeStudentAddress(input: StudentAddressInput): NormalizedStudentAddress {
  const rawCity = String(input.city ?? '').trim();
  const cityKey = rawCity.toLowerCase();
  const city = NYC_CITY_ALIASES[cityKey] || titleCaseCity(rawCity);
  const state = String(input.state ?? '').trim().toUpperCase().slice(0, 2);
  const zip = normalizeZip(String(input.zip ?? ''));
  let addressLine = String(input.address ?? '').trim();
  let apt = normalizeAptField(String(input.apt ?? ''));

  if (!apt && addressLine) {
    const { base, unit } = extractAddressUnit(addressLine);
    if (unit) {
      addressLine = base;
      apt = normalizeAptField(unit);
    }
  }

  const address = normalizeStreetLine(addressLine);

  return { address, apt, city, state, zip };
}

export function validateStudentAddress(input: StudentAddressInput): AddressValidationResult {
  const normalized = normalizeStudentAddress(input);
  const warnings: string[] = [];
  const flags: string[] = [];

  const filled = [normalized.address, normalized.city, normalized.state, normalized.zip].filter(Boolean).length;
  if (filled === 0) {
    return { normalized, warnings, flags, status: 'empty', borough: null };
  }

  if (!normalized.address) {
    warnings.push('Missing street address');
    flags.push('missing_address');
  }
  if (!normalized.city) {
    warnings.push('Missing city');
    flags.push('missing_city');
  }
  if (!normalized.state) {
    warnings.push('Missing state');
    flags.push('missing_state');
  }
  if (!normalized.zip) {
    warnings.push('Missing ZIP code');
    flags.push('missing_zip');
  }

  if (normalized.zip && !/^\d{5}$/.test(normalized.zip)) {
    warnings.push('ZIP should be 5 digits');
    flags.push('invalid_zip_format');
  }

  if (normalized.state && normalized.state !== 'NY') {
    warnings.push(`State is ${normalized.state} — expected NY for District 79`);
    flags.push('unexpected_state');
  }

  const borough = normalized.zip ? boroughFromZip(normalized.zip) : null;
  const expected = expectedBoroughsForCity(normalized.city);

  if (borough && expected.length > 0 && !expected.includes(borough)) {
    warnings.push(`City "${normalized.city}" may not match ZIP ${normalized.zip} (${borough} area)`);
    flags.push('city_zip_mismatch');
  }

  if (borough === 'Queens' && normalized.city.toLowerCase() === 'new york') {
    warnings.push('ZIP is in Queens but city is New York — use Queens or Jamaica');
    flags.push('queens_city_mismatch');
  }

  if (borough === 'Manhattan' && hasQueensStyleAddress(normalized.address)) {
    warnings.push('Queens-style address (e.g. 87-05) with a Manhattan ZIP — verify city/ZIP');
    flags.push('queens_address_manhattan_zip');
  }

  if (normalized.city.toLowerCase() === 'jamaica' && borough && borough !== 'Queens') {
    warnings.push('Jamaica is in Queens — ZIP does not match');
    flags.push('jamaica_zip_mismatch');
  }

  if (normalized.address.length > 0 && normalized.address.length < 5) {
    warnings.push('Street address looks too short');
    flags.push('address_too_short');
  }

  if (/\b(ALBERMARIE|HATMAIL)\b/i.test(
    `${normalized.address} ${input.city ?? ''} ${input.state ?? ''}`,
  )) {
    warnings.push('Possible typo in address or email domain nearby in source data');
    flags.push('possible_typo');
  }

  const raw = String(input.address ?? '');
  if (/\d{5}\s+\d{2}(ST|ND|RD|TH)/i.test(raw) && !/\d-\d{2}/.test(raw)) {
    warnings.push('Queens block number may need a hyphen (e.g. 8705 → 87-05)');
    flags.push('queens_hyphen_format');
  }

  return {
    normalized,
    warnings,
    flags,
    status: warnings.length > 0 ? 'warning' : 'ok',
    borough,
  };
}
