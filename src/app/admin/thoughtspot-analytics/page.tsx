'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import ThoughtSpotEnrollmentLiveboard from '@/components/ThoughtSpotEnrollmentLiveboard';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

const thoughtSpotHost = process.env.NEXT_PUBLIC_THOUGHTSPOT_HOST;
const liveboardId = process.env.NEXT_PUBLIC_THOUGHTSPOT_ENROLLMENT_LIVEBOARD_ID;

export default function ThoughtSpotAnalyticsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = session?.user?.role ?? '';
  const isConfigured = Boolean(thoughtSpotHost && liveboardId);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/auth/signin');
    if (status === 'authenticated' && role !== 'Admin') router.replace('/');
  }, [status, role, router]);

  if (status === 'loading' || (status === 'authenticated' && role !== 'Admin')) {
    return null;
  }

  return (
    <div className="w-full space-y-6 p-6">

      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/enrollment">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Enrollment
            </Button>
          </Link>
          <h1 className="flex items-center gap-2 text-3xl font-bold text-foreground">
            <BarChart3 className="h-8 w-8" />
            District Enrollment Analytics
          </h1>
          <p className="mt-2 text-muted-foreground">
            ThoughtSpot Liveboard for enrollment trends, intake volume, and school comparisons.
            Admin-only district view.
          </p>
        </div>
      </div>

      <Separator />

      {!isConfigured ? (
        <Alert>
          <AlertTitle>ThoughtSpot not configured yet</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>Add these environment variables to enable the embedded Liveboard:</p>
            <ul className="list-disc pl-5">
              <li><code>THOUGHTSPOT_HOST</code> and <code>NEXT_PUBLIC_THOUGHTSPOT_HOST</code></li>
              <li><code>THOUGHTSPOT_SECRET_KEY</code> (trusted auth secret from ThoughtSpot admin)</li>
              <li>
                <code>THOUGHTSPOT_ENROLLMENT_LIVEBOARD_ID</code> and{' '}
                <code>NEXT_PUBLIC_THOUGHTSPOT_ENROLLMENT_LIVEBOARD_ID</code>
              </li>
            </ul>
            <p>
              The token route uses ThoughtSpot REST API v2{' '}
              <code>POST /api/rest/2.0/auth/token/full</code> with JIT provisioning mapped from
              NextAuth roles.
            </p>
          </AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Enrollment Liveboard</CardTitle>
            <CardDescription>
              Embedded via Visual Embed SDK with cookieless trusted authentication.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ThoughtSpotEnrollmentLiveboard
              thoughtSpotHost={thoughtSpotHost!}
              liveboardId={liveboardId!}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
