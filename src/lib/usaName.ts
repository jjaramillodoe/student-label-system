/**
 * USA Latin alphabet names for intake / labels.
 * Allowed: A–Z, a–z, spaces, and hyphens. No accents, apostrophes, numbers, or other symbols.
 */
export const USA_NAME_PATTERN = /^[A-Za-z]+(?:[ -][A-Za-z]+)*$/;

export const USA_NAME_HINT =
  'Letters A–Z only, plus spaces and hyphens (e.g. Mary-Jane). Please do not use accents, apostrophes, numbers, or other special characters.';

/** Strip anything that is not A–Z, space, or hyphen. Collapses repeated spaces/hyphens lightly. */
export function sanitizeUsaNameInput(value: string): string {
  return value
    .replace(/[^A-Za-z -]/g, '')
    .replace(/ {2,}/g, ' ')
    .replace(/-{2,}/g, '-');
}

export function isValidUsaName(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return USA_NAME_PATTERN.test(trimmed);
}

export function usaNameError(value: string, label = 'Name'): string | null {
  const trimmed = value.trim();
  if (!trimmed) return `${label} is required.`;
  if (!USA_NAME_PATTERN.test(trimmed)) {
    return `${label}: ${USA_NAME_HINT}`;
  }
  return null;
}
