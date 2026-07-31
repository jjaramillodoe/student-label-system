/** URL / admin path slug from a school name, e.g. "School 8" → "school-8" */
export function schoolNameToSlug(name: string): string {
  return normalizeSchoolSlug(
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, ''),
  );
}

/** Normalize a vanity subdomain slug: "School1" → "school1", "school-8" → "school-8" */
export function normalizeSchoolSlug(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const RESERVED_SUBDOMAINS = new Set([
  'www',
  'app',
  'api',
  'admin',
  'docs',
  'staging',
  'preview',
  'mail',
  'ftp',
  'cdn',
  'static',
  'status',
  'support',
  'help',
  'auth',
  'login',
  'sso',
]);

export function isReservedSchoolSlug(slug: string): boolean {
  const s = normalizeSchoolSlug(slug);
  return !s || RESERVED_SUBDOMAINS.has(s) || s.length < 2;
}

/** Validate subdomain slug for School Settings (letters, numbers, hyphens). */
export function validateSchoolSlug(raw: string): { ok: true; slug: string } | { ok: false; error: string } {
  const slug = normalizeSchoolSlug(raw);
  if (!slug) {
    return { ok: false, error: 'Subdomain slug is required (e.g. school1 or school-8)' };
  }
  if (slug.length < 2 || slug.length > 48) {
    return { ok: false, error: 'Slug must be 2–48 characters' };
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return {
      ok: false,
      error: 'Use lowercase letters, numbers, and hyphens only (e.g. school1, school-8)',
    };
  }
  if (isReservedSchoolSlug(slug)) {
    return { ok: false, error: `"${slug}" is reserved — pick another subdomain` };
  }
  return { ok: true, slug };
}

export function slugMatchesSchoolName(slug: string, schoolName: string): boolean {
  return schoolNameToSlug(schoolName) === normalizeSchoolSlug(slug);
}

/** Explicit slug on the school record, else name-derived slug. */
export function effectiveSchoolSlug(school: { slug?: string | null; name?: string | null }): string {
  const explicit = normalizeSchoolSlug(school.slug || '');
  if (explicit) return explicit;
  return schoolNameToSlug(school.name || '');
}

export function schoolMatchesSlug(
  school: { slug?: string | null; name?: string | null },
  slug: string,
): boolean {
  const want = normalizeSchoolSlug(slug);
  if (!want) return false;
  if (normalizeSchoolSlug(school.slug || '') === want) return true;
  return slugMatchesSchoolName(want, school.name || '');
}
