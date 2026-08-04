/**
 * Host / subdomain helpers for school portals (school1.nycadultedlabels.nyc).
 * Edge-safe — no MongoDB imports.
 */

import { isReservedSchoolSlug, normalizeSchoolSlug } from '@/lib/schoolSlug';

export const TENANT_SLUG_HEADER = 'x-tenant-slug';
export const TENANT_ROOT_HEADER = 'x-tenant-root';

/** Apex / root domain for school subdomains, e.g. nycadultedlabels.nyc */
export function getTenantRootDomain(): string {
  return (process.env.TENANT_ROOT_DOMAIN || process.env.NEXT_PUBLIC_TENANT_ROOT_DOMAIN || '')
    .trim()
    .toLowerCase()
    .replace(/^\.+/, '')
    .replace(/\/$/, '');
}

/**
 * Extract school subdomain from Host.
 * - school1.nycadultedlabels.nyc → school1 (when TENANT_ROOT_DOMAIN=nycadultedlabels.nyc)
 * - nycadultedlabels.nyc / www.nycadultedlabels.nyc → null (district apex)
 * - *.vercel.app / localhost → null (single-tenant mode)
 */
export function extractTenantSlugFromHost(
  hostHeader: string | null | undefined,
  rootDomain = getTenantRootDomain(),
): string | null {
  if (!hostHeader || !rootDomain) return null;

  const host = hostHeader.split(':')[0].trim().toLowerCase();
  const root = rootDomain.replace(/^\.+/, '');
  if (!host || !root) return null;

  if (host === root || host === `www.${root}`) return null;
  if (!host.endsWith(`.${root}`)) return null;

  const sub = host.slice(0, -(root.length + 1));
  // Only one label: school1.domain.com — not a.b.domain.com
  if (!sub || sub.includes('.')) return null;

  const slug = normalizeSchoolSlug(sub);
  if (!slug || isReservedSchoolSlug(slug)) return null;
  return slug;
}

/** Public URL for a school's portal, or null if root domain not configured. */
export function schoolPortalUrl(slug: string, protocol = 'https'): string | null {
  const root = getTenantRootDomain();
  const s = normalizeSchoolSlug(slug);
  if (!root || !s) return null;
  return `${protocol}://${s}.${root}`;
}
