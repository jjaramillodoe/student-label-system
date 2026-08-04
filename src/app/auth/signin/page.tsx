'use client';

import { signIn, getProviders } from 'next-auth/react';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Eye, EyeOff, Mail, Lock, Loader2, FileText, AlertCircle, Building2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

type TenantInfo = {
  mode: string;
  slug: string | null;
  school: { name: string; slug: string } | null;
  error?: string;
};

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [error, setError] = useState('');
  const [logoError, setLogoError] = useState(false);
  const [azureEnabled, setAzureEnabled] = useState(false);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);

  useEffect(() => {
    getProviders()
      .then(providers => {
        setAzureEnabled(Boolean(providers?.['azure-ad']));
      })
      .catch(() => setAzureEnabled(false));
    fetch('/api/tenant')
      .then((r) => r.json())
      .then((data) => setTenant(data))
      .catch(() => setTenant(null));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (mfaRequired && !mfaCode.trim()) {
      setError('Enter the 6-digit code from your authenticator app.');
      setIsLoading(false);
      return;
    }

    try {
      const result = await signIn('credentials', {
        email: email.toLowerCase(),
        password,
        ...(mfaRequired ? { mfaCode: mfaCode.trim() } : {}),
        redirect: false,
        callbackUrl: '/',
      });

      if (result?.error) {
        if (result.error === 'MFA_REQUIRED') {
          setMfaRequired(true);
          setError('Enter the 6-digit code from your authenticator app.');
        } else if (result.error === 'MFA_INVALID') {
          setMfaRequired(true);
          setError('Invalid verification code.');
        } else {
          setError('Invalid email or password.');
        }
        return;
      }

      if (result?.ok) {
        // Full navigation so the session cookie is sent on the next document request
        window.location.assign('/');
        return;
      }

      setError('Sign-in did not complete. Please try again.');
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  async function handleMicrosoftSignIn() {
    setSsoLoading(true);
    setError('');
    try {
      await signIn('azure-ad', { callbackUrl: '/' });
    } catch {
      setError('Microsoft sign-in failed. Please try again or use email/password.');
      setSsoLoading(false);
    }
  }

  return (
    <div className="ui-auth-shell">
      <div className="relative z-10 w-full max-w-[420px] ui-enter">
        <div className="ui-soft-card px-6 py-8 sm:px-8 sm:py-9 space-y-7">
          <div className="space-y-4 text-center">
            <div className="flex justify-center ui-enter ui-enter-delay-1">
              {!logoError ? (
                <Image
                  src="/doe-logo.png"
                  alt="DOE Logo"
                  width={120}
                  height={120}
                  className="h-20 w-auto drop-shadow-sm"
                  priority
                  onError={() => setLogoError(true)}
                />
              ) : (
                <div className="ui-icon-mark h-16 w-16 rounded-2xl">
                  <FileText className="h-7 w-7 text-muted-foreground" />
                </div>
              )}
            </div>
            {logoError && (
              <p className="text-xs text-muted-foreground">
                DOE logo not found. Add <code className="text-xs bg-muted px-1 py-0.5 rounded">public/doe-logo.png</code> for branding.
              </p>
            )}
            <div className="space-y-2 ui-enter ui-enter-delay-2">
              <p className="ui-eyebrow">NYC Adult Education</p>
              <h1 className="ui-page-title text-[1.75rem] sm:text-[2rem]">
                Student Label System
              </h1>
              <p className="ui-page-desc mx-auto text-center">
                Sign in with your DOE email{azureEnabled ? ' or Microsoft SSO' : ' and password'}
              </p>
              {tenant?.mode === 'school' && tenant.school && (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm font-medium text-primary">
                  <Building2 className="h-3.5 w-3.5" />
                  {tenant.school.name}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-5 ui-enter ui-enter-delay-3">
            {tenant?.mode === 'unknown' && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Unknown school portal</AlertTitle>
                <AlertDescription>
                  Subdomain <strong>{tenant.slug}</strong> is not linked to a school yet.
                  Contact your Admin to set the subdomain slug in School Settings.
                </AlertDescription>
              </Alert>
            )}
            {azureEnabled && (
              <div className="space-y-3">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2 h-11"
                  size="lg"
                  disabled={ssoLoading || isLoading}
                  onClick={handleMicrosoftSignIn}
                >
                  {ssoLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <svg className="h-4 w-4" viewBox="0 0 21 21" aria-hidden="true">
                      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                    </svg>
                  )}
                  Sign in with Microsoft
                </Button>
                <div className="relative py-1">
                  <Separator />
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    or email
                  </span>
                </div>
              </div>
            )}

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-3.5">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setMfaRequired(false);
                        setMfaCode('');
                      }}
                      placeholder="Enter your email"
                      className="pl-10 h-11"
                      disabled={isLoading || ssoLoading}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setMfaRequired(false);
                        setMfaCode('');
                      }}
                      placeholder="Enter your password"
                      className="pl-10 pr-10 h-11"
                      disabled={isLoading || ssoLoading}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={isLoading || ssoLoading}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>

                {mfaRequired && (
                  <div className="space-y-1.5">
                    <Label htmlFor="mfaCode">Authenticator code</Label>
                    <Input
                      id="mfaCode"
                      name="mfaCode"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      required
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value)}
                      placeholder="Enter the 6-digit code"
                      className="h-11 tracking-[0.2em]"
                      disabled={isLoading}
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter the 6-digit code from your authenticator app.
                    </p>
                  </div>
                )}
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                className="w-full h-11"
                disabled={isLoading || ssoLoading}
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign in'
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
