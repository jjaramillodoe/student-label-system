'use client';

import { BookOpen, Mail } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MINTLIFY_DOCS_URL } from '@/lib/docsUrl';

export default function Footer() {
  const pathname = usePathname() || '';
  if (
    pathname.startsWith('/intake')
    || pathname.startsWith('/student')
    || pathname.startsWith('/archive')
    || pathname.startsWith('/auth')
    || pathname.startsWith('/docs')
  ) return null;

  return (
    <footer className="border-t border-border bg-muted/20 mt-auto">
      <div className="w-full px-4 sm:px-6 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
        <p>
          © {new Date().getFullYear()} NYC DOE Adult Education · Student Label System
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <a
            href={MINTLIFY_DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <BookOpen className="h-3 w-3" />
            Docs
          </a>
          <Link
            href="/docs"
            className="hover:text-foreground transition-colors"
          >
            In-app guide
          </Link>
          <a
            href="mailto:jjaramillo7@schools.nyc.gov"
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <Mail className="h-3 w-3" />
            Support
          </a>
        </div>
      </div>
    </footer>
  );
}
