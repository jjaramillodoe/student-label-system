'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { User, Mail, Building2, Shield, Calendar, Save, Loader2, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import PageIntro from '@/components/PageIntro';
import { QRCodeSVG } from 'qrcode.react';

export default function ProfilePage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [userData, setUserData] = useState<any>(null);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [mfaPassword, setMfaPassword] = useState('');
  const [mfaSetup, setMfaSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [mfaCode, setMfaCode] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user) {
      fetchUserData();
    }
  }, [session]);

  async function fetchUserData() {
    if (!session?.user?.email) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/users?email=${session.user.email}`);
      if (res.ok) {
        const data = await res.json();
        setUserData(data);
      }
    } catch (err) {
      console.error('Failed to fetch user data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setSuccess('');
    setError('');

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/profile/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to change password');
      }

      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setUserData((current: any) => ({ ...current, forcePasswordChange: false }));
      await update({ forcePasswordChange: false });
      setSuccess('Password changed successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password.');
    } finally {
      setSaving(false);
    }
  }

  async function handleStartMfaSetup() {
    setSuccess('');
    setError('');

    if (!mfaPassword) {
      setError('Enter your current password to update MFA.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/profile/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: mfaPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update MFA');
      }

      setMfaSetup({ secret: data.secret, otpauthUrl: data.otpauthUrl });
      setSuccess('Scan the QR code, then enter the 6-digit code from your authenticator app.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start MFA setup.');
    } finally {
      setSaving(false);
    }
  }

  async function handleVerifyMfaSetup() {
    setSuccess('');
    setError('');

    if (!mfaCode.trim()) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/profile/mfa', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: mfaCode }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to verify MFA setup');
      }

      setUserData((current: any) => ({ ...current, mfaEnabled: true }));
      setMfaPassword('');
      setMfaCode('');
      setMfaSetup(null);
      setSuccess('MFA enabled for your account.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify MFA setup.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDisableMfa() {
    setSuccess('');
    setError('');

    if (!mfaPassword) {
      setError('Enter your current password to disable MFA.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/profile/mfa', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: mfaPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to disable MFA');
      }

      setUserData((current: any) => ({ ...current, mfaEnabled: false }));
      setMfaPassword('');
      setMfaCode('');
      setMfaSetup(null);
      setSuccess('MFA disabled for your account.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable MFA.');
    } finally {
      setSaving(false);
    }
  }

  const getUserInitials = (name?: string | null) => {
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getRoleBadgeVariant = (role?: string | null) => {
    switch (role) {
      case 'Admin':
        return 'destructive';
      case 'Data Lead':
        return 'default';
      case 'Data Member':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="w-full max-w-4xl space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="w-full max-w-4xl space-y-6">
        <PageIntro
          eyebrow="Account"
          title="My Profile"
          description="View and manage your account information"
          icon={<User className="h-5 w-5 text-primary" />}
        />

        {/* Success/Error Messages */}
        {success && (
          <Alert>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {session.user.forcePasswordChange && (
          <Alert>
            <KeyRound className="h-4 w-4" />
            <AlertDescription>
              An administrator requires you to change your password before continuing.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Card */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Your account information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar */}
              <div className="flex flex-col items-center space-y-4">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={session?.user?.image || undefined} alt={session?.user?.name || 'User'} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                    {getUserInitials(session?.user?.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="text-center">
                  <h3 className="text-lg font-semibold">{session?.user?.name || 'User'}</h3>
                  <p className="text-sm text-muted-foreground">{session?.user?.email}</p>
                </div>
              </div>

              <Separator />

              {/* Role Badge */}
              {session?.user?.role && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Role</Label>
                  <div>
                    <Badge variant={getRoleBadgeVariant(session?.user?.role)}>
                      <Shield className="mr-1 h-3 w-3" />
                      {session.user.role}
                    </Badge>
                  </div>
                </div>
              )}

              {/* School */}
              {session?.user?.school && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">School</Label>
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>{session.user.school}</span>
                  </div>
                </div>
              )}

              {/* Account Created */}
              {userData?.createdAt && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Member Since</Label>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{new Date(userData.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              )}

              {/* Last Login */}
              {userData?.lastLogin && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Last Login</Label>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{new Date(userData.lastLogin).toLocaleString()}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Account Details Card */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Account Details</CardTitle>
              <CardDescription>Your personal information and account settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">
                  <User className="inline mr-2 h-4 w-4" />
                  Full Name
                </Label>
                <Input
                  id="name"
                  value={session?.user?.name || ''}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Contact an administrator to change your name
                </p>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">
                  <Mail className="inline mr-2 h-4 w-4" />
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={session?.user?.email || ''}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Your email address is used for authentication and cannot be changed
                </p>
              </div>

              {/* Role */}
              <div className="space-y-2">
                <Label htmlFor="role">
                  <Shield className="inline mr-2 h-4 w-4" />
                  Role
                </Label>
                <Input
                  id="role"
                  value={session?.user?.role || ''}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Your role determines your access level in the system
                </p>
              </div>

              {/* School */}
              {session?.user?.school && (
                <div className="space-y-2">
                  <Label htmlFor="school">
                    <Building2 className="inline mr-2 h-4 w-4" />
                    School
                  </Label>
                  <Input
                    id="school"
                    value={session.user.school}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Your assigned school location
                  </p>
                </div>
              )}

              <Separator />

              {/* Account Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Account Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {userData?.createdAt && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Account Created</Label>
                      <p className="mt-1">{new Date(userData.createdAt).toLocaleString()}</p>
                    </div>
                  )}
                  {userData?.lastLogin && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Last Login</Label>
                      <p className="mt-1">{new Date(userData.lastLogin).toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
            <CardDescription>Change your password and manage multi-factor authentication</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <KeyRound className="h-4 w-4" />
                  Change Password
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Use this if you do not want an admin to reset your password from the command line.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                  autoComplete="current-password"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Password
              </Button>
            </form>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Authenticator App MFA
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Scan a QR code with Microsoft Authenticator, Google Authenticator, 1Password, or another TOTP app.
                </p>
              </div>
              <div className="rounded-lg border p-4 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">MFA Status</p>
                    <p className="text-sm text-muted-foreground">
                      {userData?.mfaEnabled ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                  <Badge variant={userData?.mfaEnabled ? 'default' : 'outline'}>
                    {userData?.mfaEnabled ? 'On' : 'Off'}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mfaPassword">Current Password</Label>
                  <Input
                    id="mfaPassword"
                    type="password"
                    value={mfaPassword}
                    onChange={(e) => setMfaPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="Required to change MFA"
                  />
                </div>
                {mfaSetup && (
                  <div className="space-y-4 rounded-md bg-muted/40 p-4">
                    <div className="flex justify-center rounded-md bg-white p-4">
                      <QRCodeSVG value={mfaSetup.otpauthUrl} size={180} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mfaCode">Authenticator Code</Label>
                      <Input
                        id="mfaCode"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        value={mfaCode}
                        onChange={(e) => setMfaCode(e.target.value)}
                        placeholder="Enter 6-digit code"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Manual setup key: <span className="font-mono">{mfaSetup.secret}</span>
                    </p>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {userData?.mfaEnabled ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={saving}
                      onClick={handleDisableMfa}
                    >
                      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Disable MFA
                    </Button>
                  ) : mfaSetup ? (
                    <Button
                      type="button"
                      disabled={saving}
                      onClick={handleVerifyMfaSetup}
                    >
                      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Verify and Enable MFA
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      disabled={saving}
                      onClick={handleStartMfaSetup}
                    >
                      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Show QR Code
                    </Button>
                  )}
                  {mfaSetup && (
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={saving}
                      onClick={() => {
                        setMfaSetup(null);
                        setMfaCode('');
                      }}
                    >
                      Cancel Setup
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Additional Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>System Information</CardTitle>
            <CardDescription>About your account and access</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">User ID</Label>
                  <p className="text-sm font-mono">{userData?._id || 'N/A'}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Session Type</Label>
                  <p className="text-sm">JWT Token</p>
                </div>
              </div>
              <Separator />
              <div className="text-sm text-muted-foreground">
                <p>
                  For security reasons, some account information can only be changed by an administrator.
                  If you need to update your profile, please contact your system administrator.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
    </div>
  );
}

