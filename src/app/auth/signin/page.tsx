'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import Image from 'next/image';
import { Eye, EyeOff, Mail, Lock, Loader2, FileText, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [logoError, setLogoError] = useState(false);

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
      const credentials: Record<string, string | boolean> = {
        email: email.toLowerCase(),
        password,
        redirect: false,
        callbackUrl: '/',
      };

      if (mfaRequired) {
        credentials.mfaCode = mfaCode.trim();
      }

      const result = await signIn('credentials', credentials);
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
      } else if (result?.ok) {
        window.location.href = result.url || '/';
      }
    } catch (error) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-100 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            {!logoError ? (
              <Image
                src="/doe-logo.png"
                alt="DOE Logo"
                width={120}
                height={120}
                className="h-24 w-auto"
                priority
                onError={() => setLogoError(true)}
              />
            ) : (
              <div className="h-24 w-24 flex items-center justify-center bg-muted rounded-lg">
                <FileText className="h-12 w-12 text-muted-foreground" />
              </div>
            )}
          </div>
          {logoError && (
            <p className="text-xs text-center text-muted-foreground">
              DOE logo not found. Add <code className="text-xs bg-muted px-1 py-0.5 rounded">public/doe-logo.png</code> for branding.
            </p>
          )}
          <div className="text-center space-y-2">
            <CardTitle className="text-3xl">Student Label System</CardTitle>
            <CardDescription className="text-base">
              Sign in with your DOE email and password
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div className="space-y-2">
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
                    className="pl-10"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
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
                    className="pl-10 pr-10"
                    disabled={isLoading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword((v) => !v)}
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  If you use a password manager browser extension and see a hydration error, try disabling it for this page.
                </p>
              </div>

              {mfaRequired && (
                <div className="space-y-2">
                  <Label htmlFor="mfaCode">Verification Code</Label>
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
              className="w-full"
              disabled={isLoading}
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  {mfaRequired ? 'Verify and sign in' : 'Sign in'}
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
} 