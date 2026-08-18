'use client';

import { useEffect, useRef } from 'react';
import { isStudentSearchQueryValid } from '@/lib/studentSearch';

/**
 * Debounced, fire-and-forget log of client-side student searches (dashboard / palette).
 * Server classifies the query and does not persist the raw string.
 */
export function useLogStudentSearch(
  query: string,
  resultCount: number,
  source: 'dashboard' | 'command-palette',
  enabled = true,
) {
  const lastKey = useRef('');

  useEffect(() => {
    const q = query.trim();
    if (!enabled || !isStudentSearchQueryValid(q)) return;

    const t = window.setTimeout(() => {
      const key = `${source}:${q}:${resultCount}`;
      if (lastKey.current === key) return;
      lastKey.current = key;
      void fetch('/api/search-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, resultCount, source }),
      }).catch(() => {
        /* ignore analytics failures */
      });
    }, 800);

    return () => window.clearTimeout(t);
  }, [query, resultCount, source, enabled]);
}
