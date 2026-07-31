'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Building2, ExternalLink } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

type TenantInfo = {
  mode: string;
  slug: string | null;
  portalUrl: string | null;
  school: { name: string; slug: string } | null;
  error?: string;
};

/**
 * Shows which school portal the hostname maps to, and warns when the
 * signed-in user's school does not match (non-Admins).
 */
export default function TenantSchoolBanner() {
  const { data: session } = useSession();
  const [tenant, setTenant] = useState<TenantInfo | null>(null);

  useEffect(() => {
    fetch('/api/tenant')
      .then((r) => r.json())
      .then((data) => setTenant(data))
      .catch(() => setTenant(null));
  }, []);

  if (!tenant || tenant.mode === 'apex') return null;

  if (tenant.mode === 'unknown' || !tenant.school) {
    return (
      <Alert variant="destructive" className="rounded-none border-x-0 border-t-0">
        <Building2 className="h-4 w-4" />
        <AlertTitle>Unknown school portal</AlertTitle>
        <AlertDescription>
          Subdomain <strong>{tenant.slug}</strong> is not linked to an active school.
          Ask an Admin to set the subdomain slug in School Settings.
        </AlertDescription>
      </Alert>
    );
  }

  const userSchool = (session?.user as { school?: string; role?: string } | undefined)?.school || '';
  const role = (session?.user as { role?: string } | undefined)?.role || '';
  const mismatch =
    Boolean(session?.user) &&
    role !== 'Admin' &&
    userSchool &&
    userSchool.toLowerCase() !== tenant.school.name.toLowerCase();

  if (mismatch) {
    return (
      <Alert variant="destructive" className="rounded-none border-x-0 border-t-0">
        <Building2 className="h-4 w-4" />
        <AlertTitle>Wrong school portal</AlertTitle>
        <AlertDescription className="flex flex-wrap items-center gap-2">
          <span>
            This URL is for <strong>{tenant.school.name}</strong>, but your account is
            assigned to <strong>{userSchool}</strong>.
          </span>
          {tenant.portalUrl && (
            <Button asChild size="sm" variant="outline" className="gap-1">
              <a href={tenant.portalUrl}>
                Open correct portal <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="border-b bg-muted/40 px-4 py-1.5 text-xs text-muted-foreground flex items-center justify-center gap-2">
      <Building2 className="h-3.5 w-3.5" />
      <span>
        School portal: <strong className="text-foreground">{tenant.school.name}</strong>
        {tenant.slug ? (
          <span className="font-mono text-muted-foreground"> · {tenant.slug}</span>
        ) : null}
      </span>
    </div>
  );
}
