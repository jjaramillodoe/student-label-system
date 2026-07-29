/** Persist preferred label layout across sessions (dashboard + print queue). */
export const PRINT_LAYOUT_STORAGE_KEY = 'sls.printLayout';

const DEFAULT_LAYOUT = 'avery5163';

const KNOWN_LAYOUTS = new Set([
  'avery5160',
  'avery5163',
  'avery94205',
  'brother1201',
  'brother11208',
  'brother2205',
  'brother22208',
]);

export function getStoredPrintLayout(fallback = DEFAULT_LAYOUT): string {
  if (typeof window === 'undefined') return fallback;
  try {
    const stored = localStorage.getItem(PRINT_LAYOUT_STORAGE_KEY);
    if (stored && KNOWN_LAYOUTS.has(stored)) return stored;
  } catch {
    // ignore
  }
  return fallback;
}

export function setStoredPrintLayout(layout: string): void {
  if (typeof window === 'undefined') return;
  if (!KNOWN_LAYOUTS.has(layout)) return;
  try {
    localStorage.setItem(PRINT_LAYOUT_STORAGE_KEY, layout);
  } catch {
    // ignore
  }
}
