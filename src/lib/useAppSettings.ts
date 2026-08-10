'use client';

import { useEffect, useState } from 'react';

export interface AppSettings {
  showSeedTestData:   boolean;
  showSeedCabinets:   boolean;
  showClearAllData:   boolean;
  showMigrateDrawers: boolean;
  notifyLowStockEmail: boolean;
  notifyIntakeIssuesEmail: boolean;
  notificationRecipients: string;
  /** Show "still using the app?" after idle period (shared front-desk PCs). */
  idleTimeoutEnabled: boolean;
  /** Minutes without activity before the prompt (1–240). */
  idleTimeoutMinutes: number;
  /** Seconds to answer the prompt before automatic sign-out (15–300). */
  idlePromptGraceSeconds: number;
}

const DEFAULT: AppSettings = {
  showSeedTestData:   false,
  showSeedCabinets:   false,
  showClearAllData:   false,
  showMigrateDrawers: false,
  notifyLowStockEmail: true,
  notifyIntakeIssuesEmail: true,
  notificationRecipients: '',
  idleTimeoutEnabled: true,
  idleTimeoutMinutes: 15,
  idlePromptGraceSeconds: 60,
};

// Simple module-level cache so parallel component mounts share one fetch
let cached: AppSettings | null = null;
let promise: Promise<AppSettings> | null = null;

async function fetchSettings(): Promise<AppSettings> {
  if (cached) return cached;
  if (!promise) {
    promise = fetch('/api/admin/app-settings')
      .then(r => r.ok ? r.json() : DEFAULT)
      .then(data => { cached = { ...DEFAULT, ...data }; return cached!; })
      .catch(() => DEFAULT);
  }
  return promise;
}

/** Call this from any client component to get the current app settings. */
export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(cached ?? DEFAULT);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    if (cached) { setSettings(cached); setLoading(false); return; }
    fetchSettings().then(s => { setSettings(s); setLoading(false); });
  }, []);

  return { settings, loading };
}

/** Invalidate the cache (call after PATCH so next mount re-fetches). */
export function invalidateAppSettings() {
  cached = null;
  promise = null;
}
