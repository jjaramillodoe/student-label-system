'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import PageIntro from '@/components/PageIntro';
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
    <div className="w-full space-y-6">

      <PageIntro
        eyebrow="Admin"
        title="District Enrollment Analytics"
        description="ThoughtSpot Liveboard for enrollment trends, intake volume, and school comparisons. Admin-only district view."
        icon={<BarChart3 className="h-5 w-5 text-primary" />}
        back={
          <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit text-muted-foreground">
            <Link href="/admin/enrollment">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Enrollment
            </Link>
          </Button>
        }
      />

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
