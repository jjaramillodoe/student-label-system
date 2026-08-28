'use client';

import { useCallback, useSyncExternalStore } from 'react';

let current = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function apply(next: boolean, persist = true) {
  current = next;
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', next);
    if (persist) localStorage.setItem('darkMode', String(next));
  }
  emit();
}

if (typeof window !== 'undefined') {
  const saved = localStorage.getItem('darkMode');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  apply(saved !== null ? saved === 'true' : prefersDark, false);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useDarkMode() {
  const darkMode = useSyncExternalStore(subscribe, () => current, () => false);
  const setDarkMode = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    apply(typeof value === 'function' ? value(current) : value);
  }, []);
  return { darkMode, setDarkMode };
}
