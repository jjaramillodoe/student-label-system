import Link from 'next/link';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ApiDocsSwagger from '@/components/ApiDocsSwagger';

export const metadata = {
  title: 'API Reference | Student Label System',
  description: 'Interactive OpenAPI (Swagger) documentation for REST endpoints',
};

export default function ApiDocsPage() {
  return (
    <div className="w-full">
      <div className="border-b bg-muted/30 px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <div>
              <h1 className="text-lg font-semibold">API Reference</h1>
              <p className="text-sm text-muted-foreground">
                OpenAPI 3.0 · Swagger UI ·{' '}
                <a
                  href="/api/openapi.json"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  openapi.json
                </a>
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/docs">
                <ArrowLeft className="mr-2 h-4 w-4" />
                User docs
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/">Dashboard</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-2 py-2 sm:px-4">
        <p className="mb-2 text-sm text-muted-foreground">
          This page is public. Use <strong>Authorize</strong> with Bearer <code>SYNC_API_KEY</code> for
          sync endpoints, or sign in at{' '}
          <Link href="/auth/signin" className="underline">
            /auth/signin
          </Link>{' '}
          in this browser for session routes. Email Validation and ThoughtSpot are <strong>Admin-only</strong>.
        </p>
        <ApiDocsSwagger />
      </div>
    </div>
  );
}
