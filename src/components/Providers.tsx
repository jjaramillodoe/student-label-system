'use client';

import { SessionProvider } from 'next-auth/react';
import TenantSchoolBanner from '@/components/TenantSchoolBanner';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <TenantSchoolBanner />
      {children}
    </SessionProvider>
  );
}
