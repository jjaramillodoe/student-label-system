'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  Action,
  AuthType,
  RuntimeFilterOp,
} from '@thoughtspot/visual-embed-sdk';
import { LiveboardEmbed, useInit } from '@thoughtspot/visual-embed-sdk/react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

interface ThoughtSpotEnrollmentLiveboardProps {
  liveboardId: string;
  thoughtSpotHost: string;
}

async function getAuthToken(): Promise<string> {
  const response = await fetch('/api/thoughtspot/token');
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || 'Failed to fetch ThoughtSpot token');
  }
  return response.text();
}

export default function ThoughtSpotEnrollmentLiveboard({
  liveboardId,
  thoughtSpotHost,
}: ThoughtSpotEnrollmentLiveboardProps) {
  const { data: session } = useSession();
  const [error, setError] = useState<string | null>(null);

  const runtimeFilters = useMemo(() => {
    const role = (session?.user as { role?: string; school?: string } | undefined)?.role;
    const school = (session?.user as { school?: string } | undefined)?.school;

    if (role === 'Admin' || !school) {
      return undefined;
    }

    return [
      {
        columnName: 'School',
        operator: RuntimeFilterOp.EQ,
        values: [school],
      },
    ];
  }, [session]);

  useInit({
    thoughtSpotHost,
    authType: AuthType.TrustedAuthTokenCookieless,
    getAuthToken,
  });

  useEffect(() => {
    getAuthToken().catch((tokenError) => {
      setError(tokenError instanceof Error ? tokenError.message : 'Authentication failed');
    });
  }, []);

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>ThoughtSpot unavailable</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!session) {
    return <Skeleton className="h-[720px] w-full" />;
  }

  return (
    <div className="min-h-[720px] w-full overflow-hidden rounded-lg border bg-background">
      <LiveboardEmbed
        liveboardId={liveboardId}
        frameParams={{ width: '100%', height: '720px' }}
        runtimeFilters={runtimeFilters}
        hiddenActions={[Action.Edit, Action.Explore, Action.CopyLink]}
      />
    </div>
  );
}
