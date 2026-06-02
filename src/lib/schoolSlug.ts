/** URL slug for a school name, e.g. "School 8" → "school-8" */
export function schoolNameToSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function slugMatchesSchoolName(slug: string, schoolName: string): boolean {
  return schoolNameToSlug(schoolName) === slug.trim().toLowerCase();
}
