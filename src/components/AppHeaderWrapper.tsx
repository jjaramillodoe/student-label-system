'use client';

import Header from './Header';
import { usePathname } from 'next/navigation';

export default function AppHeaderWrapper() {
  const pathname = usePathname() || '';
  const hideHeader =
    pathname.startsWith('/auth') ||
    pathname.startsWith('/intake') ||
    pathname.startsWith('/student');
  if (hideHeader) return null;
  return <Header />;
} 