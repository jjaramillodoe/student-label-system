import {
  formatStudentAddressStacked,
  normalizeStudentAddress,
  type StudentAddressInput,
} from '@/lib/addressValidation';

export type AddressMatchKind =
  | 'same_verified'
  | 'same'
  | 'similar'
  | 'different'
  | 'incoming_missing'
  | 'existing_missing'
  | 'both_missing';

export interface StudentAddressRecord extends StudentAddressInput {
  apt?: string;
  addressStandardized?: (StudentAddressInput & { apt?: string }) | null;
  addressGeoclient?: { latitude?: number; longitude?: number } | null;
  addressValidationStatus?: string | null;
}

export interface IncomingAddressCheck extends StudentAddressInput {
  standardized?: StudentAddressInput | null;
  geoclient?: { latitude?: number; longitude?: number } | null;
}

export interface AddressCompareResult {
  match: AddressMatchKind;
  incomingDisplay: string | null;
  existingDisplay: string | null;
  existingVerified: boolean;
}

function stripUnit(street: string): string {
  return street
    .replace(/\s+(Apt|Unit|Ste|Fl|#)\s*.*/i, '')
    .trim()
    .toLowerCase();
}

function addressKey(input: StudentAddressInput): string {
  const n = normalizeStudentAddress(input);
  if (!n.address && !n.zip) return '';
  return [
    n.address.toLowerCase(),
    n.apt.toLowerCase(),
    n.city.toLowerCase(),
    n.state.toLowerCase(),
    n.zip,
  ].join('|');
}

function buildingKey(input: StudentAddressInput): string {
  const n = normalizeStudentAddress(input);
  if (!n.address && !n.zip) return '';
  return [
    stripUnit(n.address),
    n.city.toLowerCase(),
    n.zip,
  ].join('|');
}

function pickIncomingAddress(incoming: IncomingAddressCheck): StudentAddressInput {
  if (incoming.standardized?.address?.trim()) return incoming.standardized;
  return incoming;
}

function pickExistingAddress(existing: StudentAddressRecord): StudentAddressInput {
  if (existing.addressStandardized?.address?.trim()) {
    return {
      ...existing.addressStandardized,
      apt: existing.apt || existing.addressStandardized.apt,
    };
  }
  return existing;
}

function formatDisplay(input: StudentAddressInput): string | null {
  const stacked = formatStudentAddressStacked(input);
  if (!stacked?.streetLine) return null;
  return stacked.cityStateZip
    ? `${stacked.streetLine}, ${stacked.cityStateZip}`
    : stacked.streetLine;
}

function coordsClose(
  a?: { latitude?: number; longitude?: number } | null,
  b?: { latitude?: number; longitude?: number } | null,
): boolean {
  if (a?.latitude == null || a?.longitude == null || b?.latitude == null || b?.longitude == null) {
    return false;
  }
  const latDiff = Math.abs(a.latitude - b.latitude);
  const lngDiff = Math.abs(a.longitude - b.longitude);
  return latDiff < 0.0005 && lngDiff < 0.0005;
}

function studentToIncomingCheck(record: StudentAddressRecord): IncomingAddressCheck {
  const picked = pickExistingAddress(record);
  return {
    address: picked.address,
    apt: picked.apt,
    city: picked.city,
    state: picked.state,
    zip: picked.zip,
    standardized: record.addressStandardized ?? null,
    geoclient: record.addressGeoclient ?? null,
  };
}

/** Compare home addresses between two existing student records (A vs B). */
export function comparePeerAddresses(
  a: StudentAddressRecord,
  b: StudentAddressRecord,
): AddressCompareResult {
  return compareStudentAddresses(studentToIncomingCheck(a), b);
}

export function isSameAddressPair(
  a: StudentAddressRecord,
  b: StudentAddressRecord,
): boolean {
  const cmp = comparePeerAddresses(a, b);
  return cmp.match === 'same_verified' || cmp.match === 'same' || cmp.match === 'similar';
}

/** Compare incoming intake address with an existing student record. */
export function compareStudentAddresses(
  incoming: IncomingAddressCheck,
  existing: StudentAddressRecord,
): AddressCompareResult {
  const incomingPick = pickIncomingAddress(incoming);
  const existingPick = pickExistingAddress(existing);
  const incomingHas = Boolean(incomingPick.address?.trim() || incomingPick.zip?.trim());
  const existingHas = Boolean(existingPick.address?.trim() || existingPick.zip?.trim());

  const incomingDisplay = formatDisplay(incomingPick);
  const existingDisplay = formatDisplay(existingPick);
  const existingVerified = ['verified', 'warning'].includes(
    String(existing.addressValidationStatus ?? ''),
  );

  if (!incomingHas && !existingHas) {
    return { match: 'both_missing', incomingDisplay, existingDisplay, existingVerified };
  }
  if (!incomingHas) {
    return { match: 'incoming_missing', incomingDisplay, existingDisplay, existingVerified };
  }
  if (!existingHas) {
    return { match: 'existing_missing', incomingDisplay, existingDisplay, existingVerified };
  }

  if (
    coordsClose(incoming.geoclient, existing.addressGeoclient)
    || addressKey(incomingPick) === addressKey(existingPick)
  ) {
    const verified = existingVerified
      && Boolean(incoming.standardized?.address || incoming.geoclient);
    return {
      match: verified ? 'same_verified' : 'same',
      incomingDisplay,
      existingDisplay,
      existingVerified,
    };
  }

  if (buildingKey(incomingPick) === buildingKey(existingPick)) {
    return { match: 'similar', incomingDisplay, existingDisplay, existingVerified };
  }

  return { match: 'different', incomingDisplay, existingDisplay, existingVerified };
}

export function hasComparableAddress(input: StudentAddressInput): boolean {
  const n = normalizeStudentAddress(input);
  return Boolean(n.address?.trim() && n.zip?.trim());
}

/** Boost name-match score when home address also aligns (capped at 100). */
export function boostMatchPercentForAddress(
  basePercent: number,
  addressMatch: AddressMatchKind,
): number {
  if (addressMatch === 'same_verified') return Math.min(100, basePercent + 20);
  if (addressMatch === 'same' || addressMatch === 'similar') {
    return Math.min(100, basePercent + 12);
  }
  return basePercent;
}

export function addressMatchLabel(match: AddressMatchKind): string {
  switch (match) {
    case 'same_verified':
      return 'Same verified address';
    case 'same':
      return 'Same address';
    case 'similar':
      return 'Same building';
    case 'different':
      return 'Different address';
    case 'incoming_missing':
      return 'New address not entered';
    case 'existing_missing':
      return 'No address on file';
    default:
      return 'Address unknown';
  }
}

export function addressMatchHint(match: AddressMatchKind): string {
  switch (match) {
    case 'same_verified':
      return 'Standardized NYC address matches — strong duplicate signal.';
    case 'same':
      return 'Home address matches the record on file.';
    case 'similar':
      return 'Same building — may be a different unit or apartment.';
    case 'different':
      return 'Address differs — student may have moved, or this could be a sibling.';
    case 'incoming_missing':
      return 'Enter and verify the new student\'s address for a stronger duplicate check.';
    case 'existing_missing':
      return 'Existing record has no address — name and DOB are the only signals.';
    default:
      return '';
  }
}
