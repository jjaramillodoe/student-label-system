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
import { MINTLIFY_DOCS_URL } from '@/lib/docsUrl';

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
    <div className="signin-root">
      <aside className="signin-brand">
        <div className="signin-label-rail" aria-hidden="true">
          <span style={{ top: '18%', right: '42%' }}>Label archive</span>
          <span style={{ top: '48%', right: '18%' }}>Cabinet · Drawer</span>
        </div>

        <div className="relative z-10 space-y-8">
          <div className="signin-rise flex items-center gap-3">
            {!logoError ? (
              <Image
                src="/doe-logo.png"
                alt="DOE Logo"
                width={56}
                height={56}
                className="h-12 w-auto sm:h-14"
                priority
                onError={() => setLogoError(true)}
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-black/10 bg-white/50 dark:border-white/10 dark:bg-white/5">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div className="text-left leading-tight">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[hsl(var(--signin-ink-soft))]">
                Department of Education
              </p>
              <p className="text-sm font-medium text-[hsl(var(--signin-ink))]">
                New York City
              </p>
            </div>
          </div>

          <div className="max-w-xl space-y-4">
            <p className="signin-brand-kicker signin-rise signin-rise-delay-1">
              NYC Adult Education
            </p>
            <h1 className="signin-brand-title signin-rise signin-rise-delay-2">
              Student Label System
            </h1>
            <p className="signin-rise signin-rise-delay-3 max-w-md text-base leading-relaxed text-[hsl(var(--signin-ink-soft))] sm:text-lg">
              Sign in to manage student labels, cabinets, and intake for Adult Education programs.
            </p>
          </div>
        </div>

        <div className="relative z-10 mt-10 hidden max-w-md space-y-1 text-sm text-[hsl(var(--signin-ink-soft))] lg:block">
          <p className="font-medium text-[hsl(var(--signin-ink))]">For DOE staff</p>
          <p>Use your schools.nyc.gov account. Contact your Data Lead if you need access.</p>
        </div>
      </aside>

      <main className="signin-panel signin-panel-in">
        <div className="mx-auto w-full max-w-[400px] space-y-7">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              Sign in
            </h2>
            <p className="text-sm text-muted-foreground">
              DOE email{azureEnabled ? ' or Microsoft SSO' : ' and password'}
              {tenant?.mode === 'school' && tenant.school ? (
                <>
                  {' '}for{' '}
                  <span className="font-medium text-foreground">{tenant.school.name}</span>
                </>
              ) : null}
            </p>
            {tenant?.mode === 'school' && tenant.school && (
              <div className="flex items-center gap-2 border-l-2 border-[hsl(var(--signin-sky))] pl-3 text-sm text-muted-foreground">
                <Building2 className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--signin-sky))]" />
                <span>School portal · {tenant.school.name}</span>
              </div>
            )}
          </div>

          <div className="space-y-5">
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
                  className="h-11 w-full gap-2"
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
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[hsl(var(--signin-paper))] px-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
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
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
                      placeholder="name@schools.nyc.gov"
                      className="h-11 pl-10"
                      disabled={isLoading || ssoLoading}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
                      className="h-11 pl-10 pr-10"
                      disabled={isLoading || ssoLoading}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={isLoading || ssoLoading}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
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
                className="h-11 w-full"
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

          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            Need help?{' '}
            <a
              href={MINTLIFY_DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Documentation
            </a>
            <span className="mx-1.5 text-border">·</span>
            © {new Date().getFullYear()} NYC DOE Adult Education
          </p>
        </div>
      </main>
    </div>
  );
}
