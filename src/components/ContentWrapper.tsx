'use client';

/**
 * @deprecated Content padding is handled by `AppShell`.
 * Kept so older imports do not break.
 */
export default function ContentWrapper({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
