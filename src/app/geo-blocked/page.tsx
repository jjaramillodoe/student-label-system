import { MapPin, Shield } from 'lucide-react';
import { MINTLIFY_DOCS_URL } from '@/lib/docsUrl';
import { developerCreditShort } from '@/lib/credits';

export const metadata = {
  title: 'Access limited to New York State',
  robots: { index: false, follow: false },
};

export default function GeoBlockedPage() {
  return (
    <div className="ui-auth-shell">
      <div className="relative z-10 w-full max-w-lg space-y-6 text-center px-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card shadow-sm">
          <Shield className="h-7 w-7 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            NYC Adult Education · Student Label System
          </p>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center justify-center gap-2">
            <MapPin className="h-6 w-6 text-muted-foreground" />
            New York State only
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            This application is available only from locations in{' '}
            <strong className="text-foreground">New York State</strong> for
            Adult Education staff. If you are on a DOE network or VPN in New York
            and still see this page, contact your Data Lead.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          <a
            href={MINTLIFY_DOCS_URL}
            className="underline underline-offset-2 hover:text-foreground"
            target="_blank"
            rel="noopener noreferrer"
          >
            Documentation
          </a>
          {' · '}
          {developerCreditShort()}
        </p>
      </div>
    </div>
  );
}
