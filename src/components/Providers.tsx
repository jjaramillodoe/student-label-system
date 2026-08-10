'use client';

import { SessionProvider } from 'next-auth/react';
import TenantSchoolBanner from '@/components/TenantSchoolBanner';
import IdleSessionGuard from '@/components/IdleSessionGuard';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <TenantSchoolBanner />
      <IdleSessionGuard />
      {children}
    </SessionProvider>
  );
}
