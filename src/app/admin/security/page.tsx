'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle, Loader2, RefreshCw, Shield, ShieldAlert,
} from 'lucide-react';
import PageIntro from '@/components/PageIntro';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

type AuthEventRow = {
  _id: string;
  type: string;
  email: string;
  reason?: string;
  ip?: string | null;
  userAgent?: string | null;
  at: string;
};

type LockedAccount = {
  _id: string;
  email: string;
  name: string;
  school: string;
  role: string;
  lockedUntil: string;
  failedLoginCount: number;
};

const TYPE_BADGE: Record<string, string> = {
  login_failure: 'ui-badge-danger',
  user_unknown: 'ui-badge-danger',
  mfa_failure: 'ui-badge-warning',
  mfa_disabled: 'ui-badge-warning',
  mfa_enabled: 'ui-badge-success',
  account_locked: 'ui-badge-danger',
  account_unlocked: 'ui-badge-success',
  user_created: 'ui-badge-muted',
  login_success: 'ui-badge-success',
};

function typeLabel(type: string) {
  switch (type) {
    case 'login_failure': return 'Bad password';
    case 'user_unknown': return 'Unknown user';
    case 'mfa_failure': return 'Bad MFA';
    case 'mfa_disabled': return 'MFA disabled';
    case 'mfa_enabled': return 'MFA enabled';
    case 'account_locked': return 'Account locked';
    case 'account_unlocked': return 'Unlocked';
    case 'user_created': return 'User created';
    case 'login_success': return 'Signed in';
    default: return type;
  }
}

export default function AdminSecurityPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [events, setEvents] = useState<AuthEventRow[]>([]);
  const [lockedAccounts, setLockedAccounts] = useState<LockedAccount[]>([]);
  const [summary, setSummary] = useState({ failures: 0, mfaFailures: 0, successes: 0, locked: 0 });
  const [type, setType] = useState('all');
  const [email, setEmail] = useState('');
  const [hours, setHours] = useState('72');
  const [unlockingId, setUnlockingId] = useState('');

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) { router.push('/auth/signin'); return; }
    if (role !== 'Admin') { router.push('/'); return; }
  }, [session, status, role, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        limit: '200',
        hours,
        type,
      });
      if (email.trim()) params.set('email', email.trim());
      const res = await fetch(`/api/admin/security-events?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setEvents(data.events || []);
      setLockedAccounts(data.lockedAccounts || []);
      setSummary(data.summary || { failures: 0, mfaFailures: 0, successes: 0, locked: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [hours, type, email]);

  const unlock = useCallback(async (userId: string) => {
    setUnlockingId(userId);
    setError('');
    try {
      const res = await fetch(`/api/admin/users/${userId}/security`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unlock-account' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unlock failed');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unlock failed');
    } finally {
      setUnlockingId('');
    }
  }, [load]);

  useEffect(() => {
    if (status === 'authenticated' && role === 'Admin') void load();
  }, [status, role, load]);

  if (status === 'loading' || (status === 'authenticated' && role !== 'Admin' && !error)) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <PageIntro
        eyebrow="Admin"
        title="Security"
        description="Failed sign-ins, lockouts, MFA events, and new accounts. Admins are emailed on repeated failures and lockouts."
        icon={<Shield className="h-5 w-5 text-primary" />}
        actions={
          <Button variant="outline" onClick={() => void load()} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        }
      />

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Password / unknown (window)</CardDescription>
            <CardTitle className="text-2xl tabular-nums text-destructive">{summary.failures}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>MFA failures</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{summary.mfaFailures}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Successful sign-ins</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{summary.successes}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Currently locked</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{summary.locked ?? lockedAccounts.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {lockedAccounts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Locked accounts</CardTitle>
            <CardDescription>
              Locked after 8 failed password/MFA attempts (~30 minutes). Unlock immediately if the staff member needs access.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>School</TableHead>
                    <TableHead>Fails</TableHead>
                    <TableHead>Unlocks at</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lockedAccounts.map((u) => (
                    <TableRow key={u._id}>
                      <TableCell>
                        <div className="font-medium text-sm">{u.name || '—'}</div>
                        <div className="font-mono text-xs text-muted-foreground">{u.email}</div>
                      </TableCell>
                      <TableCell className="text-xs">{u.school || '—'}</TableCell>
                      <TableCell className="tabular-nums text-xs">{u.failedLoginCount}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs tabular-nums">
                        {u.lockedUntil ? new Date(u.lockedUntil).toLocaleString() : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={unlockingId === u._id}
                          onClick={() => void unlock(u._id)}
                        >
                          {unlockingId === u._id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            'Unlock'
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" /> Auth events
          </CardTitle>
          <CardDescription>Filter the recent window. Emails never include passwords.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Select value={hours} onValueChange={setHours}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Window" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24">Last 24 hours</SelectItem>
                <SelectItem value="72">Last 72 hours</SelectItem>
                <SelectItem value="168">Last 7 days</SelectItem>
              </SelectContent>
            </Select>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="login_failure">Bad password</SelectItem>
                <SelectItem value="user_unknown">Unknown user</SelectItem>
                <SelectItem value="mfa_failure">Bad MFA</SelectItem>
                <SelectItem value="mfa_disabled">MFA disabled</SelectItem>
                <SelectItem value="mfa_enabled">MFA enabled</SelectItem>
                <SelectItem value="account_locked">Account locked</SelectItem>
                <SelectItem value="account_unlocked">Unlocked</SelectItem>
                <SelectItem value="user_created">User created</SelectItem>
                <SelectItem value="login_success">Signed in</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Filter email…"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="max-w-xs"
            />
            <Button onClick={() => void load()} disabled={loading}>Apply</Button>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading…
                    </TableCell>
                  </TableRow>
                ) : events.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No events in this window.
                    </TableCell>
                  </TableRow>
                ) : (
                  events.map((e) => (
                    <TableRow key={e._id}>
                      <TableCell className="whitespace-nowrap text-xs tabular-nums">
                        {new Date(e.at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <span className={`${TYPE_BADGE[e.type] || 'ui-badge-muted'} text-[10px]`}>
                          {typeLabel(e.type)}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{e.email}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{e.ip || '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[240px] truncate" title={e.reason || e.userAgent || ''}>
                        {e.reason || '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
