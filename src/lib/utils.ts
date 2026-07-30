import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Parse a calendar date without UTC shift.
 * `new Date("1990-01-01")` is UTC midnight and shows as Dec 31, 1989 in US timezones.
 */
export function parseCalendarDate(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null;
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    const fallback = new Date(value);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

/** e.g. "Wednesday, May 22, 1979" — helps intake staff verify date picker values. */
export function formatHumanDate(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  // Strict YYYY-MM-DD only (same as historical behavior for long weekday form).
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return null;
  const date = parseCalendarDate(value);
  if (!date) return null;
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/** e.g. "Jan 1, 1990" — safe for DOB / startDate display in tables. */
export function formatShortDate(value: string | null | undefined): string | null {
  const date = parseCalendarDate(value);
  if (!date) return null;
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Normalize MongoDB ObjectId / Extended JSON values to a plain hex string. */
export function normalizeMongoId(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null) {
    const oid = (value as { $oid?: string }).$oid;
    if (typeof oid === 'string') return oid;
    const toHexString = (value as { toHexString?: () => string }).toHexString;
    if (typeof toHexString === 'function') return toHexString.call(value);
    const str = (value as { toString?: () => string }).toString?.();
    if (typeof str === 'string' && /^[a-f\d]{24}$/i.test(str)) return str;
  }
  return null;
}

export function serializeMongoDocument<T extends Record<string, unknown>>(doc: T): T & { _id: string } {
  return {
    ...doc,
    _id: (normalizeMongoId(doc._id) ?? String(doc._id)) as string,
  };
}

