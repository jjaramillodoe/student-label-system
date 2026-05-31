'use client';

import { usePathname } from 'next/navigation';

export default function ContentWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  // Intake and student detail pages manage their own full-screen layout
  const isFullscreen = pathname.startsWith('/intake') || pathname.startsWith('/student');
  if (isFullscreen) return <>{children}</>;
  return (
    <main className="w-full max-w-full px-4 sm:px-6 py-6 flex-1">
      {children}
    </main>
  );
}
