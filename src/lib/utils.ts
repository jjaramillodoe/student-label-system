import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** e.g. "Wednesday, May 22, 1979" — helps intake staff verify date picker values. */
export function formatHumanDate(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (Number.isNaN(date.getTime())) return null;
  if (
    date.getFullYear() !== Number(year)
    || date.getMonth() !== Number(month) - 1
    || date.getDate() !== Number(day)
  ) {
    return null;
  }
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
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

