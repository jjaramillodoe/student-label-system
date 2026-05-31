'use client';

import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() || '';
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    // Only redirect to signin if not on signin, error, or clear pages
    if (status === 'unauthenticated' && 
        !pathname.startsWith('/auth/signin') && 
        !pathname.startsWith('/auth/error') && 
        !pathname.startsWith('/auth/clear')) {
      router.push('/auth/signin');
    }
  }, [status, pathname, router]);

  // Hide header on auth pages (strict match)
  const hideHeader =
    pathname.startsWith('/auth/signin') ||
    pathname.startsWith('/auth/error') ||
    pathname.startsWith('/auth/clear');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {!hideHeader && <Header />}
      {children}
    </div>
  );
} 