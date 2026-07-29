'use client';

import { BookOpen, Mail, Building2, Code } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MINTLIFY_DOCS_URL } from '@/lib/docsUrl';

export default function Footer() {
  const pathname = usePathname() || '';
  if (
    pathname.startsWith('/intake')
    || pathname.startsWith('/student')
    || pathname.startsWith('/archive')
  ) return null;
  return (
    <footer className="border-t border-border bg-muted/30 mt-auto">
      <div className="w-full px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Adult Education Info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-foreground">Adult Education</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Student Label Management System
            </p>
            <p className="text-sm text-muted-foreground">
              Department of Education
            </p>
          </div>

          {/* System Info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Code className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-foreground">System Information</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Version 1.0.0
            </p>
            <p className="text-sm text-muted-foreground">
              Built with Next.js & MongoDB
            </p>
            <a
              href={MINTLIFY_DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              <BookOpen className="h-3 w-3" />
              Documentation
            </a>
            <Link
              href="/docs"
              className="text-sm text-muted-foreground hover:text-primary hover:underline flex items-center gap-1"
            >
              In-app guide
            </Link>
          </div>

          {/* Developer Contact */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-foreground">Developer Contact</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Javier Jaramillo
            </p>
            <a
              href="mailto:jjaramillo7@schools.nyc.gov"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              <Mail className="h-3 w-3" />
              jjaramillo7@schools.nyc.gov
            </a>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-border">
          <p className="text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} Department of Education - Adult Education. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

