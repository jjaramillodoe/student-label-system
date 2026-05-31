export const DEFAULT_INTAKE_SESSIONS = [
  'MORNING 8am-4pm',
  'EVENING 4pm-5pm',
  'SATURDAY',
  'MS265',
  'SSHS',
  'BUSHWICK-EVENING',
  'RIDGEWOOD',
];

export const DEFAULT_INTAKE_ACTIVITIES = [
  'Intake Paperwork Only',
  'Orientation',
  'Testing',
  'Locator',
  'Placement',
  'Additional Classes',
  'Transfer',
];

export function normalizeIntakeStringList(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .map(v => v.trim());
}
