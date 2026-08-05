'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

function messageForError(error: string): { title: string; body: string } {
  switch (error) {
    case 'AccessDenied':
      return {
        title: 'Access denied',
        body: 'You do not have permission to access this system. Please use your DOE email address.',
      };
    case 'UserNotProvisioned':
      return {
        title: 'Account not provisioned',
        body: 'Your Microsoft account is valid, but you are not provisioned in the Student Label System yet. Ask an Admin to add your @schools.nyc.gov email under User Management.',
      };
    case 'DomainNotAllowed':
      return {
        title: 'Domain not allowed',
        body: 'Only approved DOE email domains can sign in with Microsoft SSO.',
      };
    case 'EmailRequired':
      return {
        title: 'Email required',
        body: 'Microsoft did not return an email address for this account.',
      };
    default:
      return {
        title: 'Sign-in error',
        body: 'An error occurred during authentication. Please try again.',
      };
  }
}

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams?.get('error') || '';
  const { title, body } = messageForError(error);

  return (
    <div className="signin-root">
      <aside className="signin-brand">
        <div className="relative z-10 max-w-xl space-y-4">
          <p className="signin-brand-kicker signin-rise">NYC Adult Education</p>
          <h1 className="signin-brand-title signin-rise signin-rise-delay-1">
            Student Label System
          </h1>
          <p className="signin-rise signin-rise-delay-2 text-base leading-relaxed text-[hsl(var(--signin-ink-soft))] sm:text-lg">
            We could not complete sign-in. Review the message on the right, then try again.
          </p>
        </div>
      </aside>

      <main className="signin-panel signin-panel-in">
        <div className="mx-auto w-full max-w-[400px] space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              Authentication error
            </h2>
            <p className="text-sm text-muted-foreground">
              Return to sign-in when you are ready to try again.
            </p>
          </div>

          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{title}</AlertTitle>
            <AlertDescription>{body}</AlertDescription>
          </Alert>

          <Button asChild className="h-11 w-full" size="lg">
            <Link href="/auth/signin">Return to Sign In</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}

export default function ErrorPage() {
  return (
    <Suspense fallback={null}>
      <AuthErrorContent />
    </Suspense>
  );
}
