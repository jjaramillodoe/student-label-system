/** NYC-style school year label, e.g. "2025-2026". Year starts in July. */
export function getCurrentFiscalYear(date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth();
  if (month >= 6) {
    return `${year}-${year + 1}`;
  }
  return `${year - 1}-${year}`;
}

/** Recent school years for dropdowns (includes one prior year). */
export function getFiscalYearOptions(anchorDate = new Date()): string[] {
  const current = getCurrentFiscalYear(anchorDate);
  const startYear = parseInt(current.split('-')[0], 10);
  return [
    `${startYear - 1}-${startYear}`,
    `${startYear}-${startYear + 1}`,
    `${startYear + 1}-${startYear + 2}`,
    `${startYear + 2}-${startYear + 3}`,
  ];
}

export function normalizeFiscalYear(value: unknown, fallback?: string): string {
  if (typeof value === 'string' && /^\d{4}-\d{4}$/.test(value.trim())) {
    return value.trim();
  }
  return fallback ?? getCurrentFiscalYear();
}
