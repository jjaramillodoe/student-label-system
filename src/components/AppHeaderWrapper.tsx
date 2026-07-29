'use client';

import Header from './Header';
import { usePathname } from 'next/navigation';

/** Routes that are public (QR scans) or have their own chrome — do not mount the global Header auth redirect. */
export default function AppHeaderWrapper() {
  const pathname = usePathname() || '';
  const hideHeader =
    pathname.startsWith('/auth') ||
    pathname.startsWith('/intake') ||
    pathname.startsWith('/student') ||
    pathname.startsWith('/archive');
  if (hideHeader) return null;
  return <Header />;
} 