import {
  DEFAULT_INTAKE_SESSION_CONFIGS,
  normalizeIntakeSessions,
} from '@/lib/intakeSession';

export const DEFAULT_INTAKE_SESSIONS = DEFAULT_INTAKE_SESSION_CONFIGS.map((s) => s.name);

export { DEFAULT_INTAKE_SESSION_CONFIGS, normalizeIntakeSessions };
export type { IntakeSession } from '@/lib/intakeSession';

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
