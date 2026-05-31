/**
 * Build MongoDB $or conditions for student text search (name, IDs, DOB).
 * DOB is stored as YYYY-MM-DD; users may type slashes, dashes, or compact digits.
 */
export function normalizeDobToIso(input: string): string | null {
  const trimmed = input.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const [, m, d, y] = slash;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const dash = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dash) {
    const [, m, d, y] = dash;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const compact = trimmed.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (compact) {
    const [, m, d, y] = compact;
    return `${y}-${m}-${d}`;
  }

  return null;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function isStudentSearchQueryValid(query: string): boolean {
  const q = query.trim();
  if (!q) return false;
  if (q.length >= 2) return true;
  return normalizeDobToIso(q) !== null;
}

export function buildStudentSearchOrConditions(search: string): Record<string, unknown>[] {
  const trimmed = search.trim();
  if (!trimmed) return [];

  const safe = escapeRegex(trimmed);
  const rx = { $regex: safe, $options: 'i' };

  const or: Record<string, unknown>[] = [
    { firstName: rx },
    { lastName: rx },
    { labelId: rx },
    { studentId: rx },
  ];

  const iso = normalizeDobToIso(trimmed);
  if (iso) {
    or.push({ dob: iso });
    or.push({ dob: { $regex: `^${escapeRegex(iso)}`, $options: 'i' } });
  }

  // Partial ISO prefix: 1963-03 or 1963
  if (/^\d{4}(-\d{1,2})?(-\d{1,2})?$/.test(trimmed)) {
    or.push({ dob: { $regex: `^${escapeRegex(trimmed)}`, $options: 'i' } });
  }

  // Raw DOB substring (e.g. user pasted part of a date)
  if (/[\d/-]/.test(trimmed)) {
    or.push({ dob: rx });
  }

  return or;
}
