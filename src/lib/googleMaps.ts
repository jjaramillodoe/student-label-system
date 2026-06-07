export interface GoogleMapsLinkInput {
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

/** Build a Google Maps search URL — prefers lat/lng when Geoclient provided coordinates. */
export function googleMapsSearchUrl(input: GoogleMapsLinkInput): string | null {
  const lat = input.latitude;
  const lng = input.longitude;
  if (typeof lat === 'number' && typeof lng === 'number' && !Number.isNaN(lat) && !Number.isNaN(lng)) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }

  const parts = [input.address, input.city, input.state, input.zip]
    .map(v => String(v ?? '').trim())
    .filter(Boolean);
  if (parts.length === 0) return null;

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.join(', '))}`;
}
