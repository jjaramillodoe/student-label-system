import type { Db } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { getAuthRequest, getClientIp, getClientUserAgent } from '@/lib/authRequestContext';
import {
  getNotificationSettings,
  resolveNotificationRecipients,
} from '@/lib/notifications';
import { isEmailConfigured, sendEmail } from '@/lib/email';
import { LOCKOUT_DURATION_MS, LOCKOUT_THRESHOLD } from '@/lib/authLockout';

export { isAccountLocked, LOCKOUT_DURATION_MS, LOCKOUT_THRESHOLD } from '@/lib/authLockout';

export const AUTH_EVENTS_COLLECTION = 'auth_events';

export type AuthEventType =
  | 'login_failure'
  | 'login_success'
  | 'mfa_failure'
  | 'mfa_disabled'
  | 'mfa_enabled'
  | 'user_unknown'
  | 'account_locked'
  | 'account_unlocked'
  | 'user_created';

export type AuthEvent = {
  type: AuthEventType;
  email: string;
  reason?: string;
  ip?: string | null;
  userAgent?: string | null;
  at: string;
  meta?: Record<string, unknown>;
};

const FAILURE_ALERT_THRESHOLD = 5;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const ALERT_COOLDOWN_MS = 60 * 60 * 1000;

function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || '').replace(/\/$/, '');
}

export async function logAuthEvent(input: {
  type: AuthEventType;
  email: string;
  reason?: string;
  meta?: Record<string, unknown>;
  /** Persist the event but skip email alerts (e.g. per-row bulk create). */
  suppressAlert?: boolean;
}): Promise<void> {
  try {
    const req = getAuthRequest();
    const client = await clientPromise;
    const db = client.db('student-label');
    const event: AuthEvent = {
      type: input.type,
      email: normalizeEmail(input.email) || '(unknown)',
      reason: input.reason,
      ip: getClientIp(req),
      userAgent: getClientUserAgent(req)?.slice(0, 300) || null,
      at: new Date().toISOString(),
      meta: input.meta,
    };
    await db.collection(AUTH_EVENTS_COLLECTION).insertOne(event);

    if (input.suppressAlert) return;

    if (input.type === 'login_failure' || input.type === 'mfa_failure' || input.type === 'user_unknown') {
      void maybeAlertRepeatedFailures(db, event.email).catch((err) => {
        console.error('[authSecurity] alert failed', err);
      });
    }

    if (input.type === 'mfa_disabled') {
      void maybeAlertMfaDisabled(db, event).catch((err) => {
        console.error('[authSecurity] MFA disable alert failed', err);
      });
    }

    if (input.type === 'account_locked') {
      void maybeAlertAccountLocked(db, event).catch((err) => {
        console.error('[authSecurity] lockout alert failed', err);
      });
    }

    if (input.type === 'user_created') {
      void maybeAlertUserCreated(db, event).catch((err) => {
        console.error('[authSecurity] user-created alert failed', err);
      });
    }
  } catch (err) {
    console.error('[authSecurity] logAuthEvent failed', err);
  }
}

/**
 * Increment failed-login counter; lock account when threshold is reached.
 * Returns whether the account is now locked.
 */
export async function recordCredentialFailure(userId: unknown, email: string): Promise<{
  locked: boolean;
  failedLoginCount: number;
  lockedUntil?: string;
}> {
  const client = await clientPromise;
  const db = client.db('student-label');
  const users = db.collection('users');

  await users.updateOne(
    { _id: userId as never },
    {
      $inc: { failedLoginCount: 1 },
      $set: { updatedAt: new Date().toISOString() },
    },
  );

  const doc = await users.findOne(
    { _id: userId as never },
    { projection: { failedLoginCount: 1, lockedUntil: 1 } },
  );
  const count = Number(doc?.failedLoginCount || 0);

  if (count >= LOCKOUT_THRESHOLD) {
    const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString();
    await users.updateOne(
      { _id: userId as never },
      { $set: { lockedUntil, updatedAt: new Date().toISOString() } },
    );
    await logAuthEvent({
      type: 'account_locked',
      email,
      reason: `Locked after ${count} failed sign-in attempts`,
      meta: { failedLoginCount: count, lockedUntil, minutes: LOCKOUT_DURATION_MS / 60000 },
    });
    return { locked: true, failedLoginCount: count, lockedUntil };
  }

  return { locked: false, failedLoginCount: count };
}

export async function clearCredentialFailures(userId: unknown): Promise<void> {
  const client = await clientPromise;
  const db = client.db('student-label');
  await db.collection('users').updateOne(
    { _id: userId as never },
    {
      $set: { failedLoginCount: 0, updatedAt: new Date().toISOString() },
      $unset: { lockedUntil: '' },
    },
  );
}

export async function unlockAccount(userId: unknown, email: string, by: {
  byEmail?: string;
  byName?: string;
}): Promise<void> {
  await clearCredentialFailures(userId);
  await logAuthEvent({
    type: 'account_unlocked',
    email,
    reason: 'Admin unlocked account',
    meta: {
      byEmail: by.byEmail || '',
      byName: by.byName || '',
    },
  });
}

/**
 * Admin testing/QA exemption: skip MFA challenge and enrollment until re-enabled.
 * Does not clear an existing authenticator enrollment.
 */
export async function applyMfaBypass(
  userId: unknown,
  email: string,
  bypass: boolean,
  by: { byEmail?: string; byName?: string },
): Promise<{ changed: boolean }> {
  const client = await clientPromise;
  const db = client.db('student-label');
  const users = db.collection('users');
  const existing = await users.findOne(
    { _id: userId as never },
    { projection: { mfaBypass: 1 } },
  );
  if (!existing) return { changed: false };
  if (Boolean(existing.mfaBypass) === bypass) return { changed: false };

  await users.updateOne(
    { _id: userId as never },
    { $set: { mfaBypass: bypass, updatedAt: new Date().toISOString() } },
  );

  await logAuthEvent({
    type: bypass ? 'mfa_disabled' : 'mfa_enabled',
    email,
    reason: bypass
      ? 'Admin disabled MFA (login bypass for testing/QA)'
      : 'Admin re-enabled MFA requirement',
    meta: {
      byEmail: by.byEmail || '',
      byName: by.byName || '',
      userId: String(userId),
      bypass,
    },
  });

  return { changed: true };
}

export async function listLockedAccounts(): Promise<Array<{
  _id: string;
  email: string;
  name: string;
  school: string;
  role: string;
  lockedUntil: string;
  failedLoginCount: number;
}>> {
  const client = await clientPromise;
  const db = client.db('student-label');
  const now = new Date().toISOString();
  const rows = await db.collection('users').find(
    { lockedUntil: { $gt: now } },
    {
      projection: {
        email: 1,
        name: 1,
        school: 1,
        role: 1,
        lockedUntil: 1,
        failedLoginCount: 1,
      },
    },
  ).sort({ lockedUntil: -1 }).limit(50).toArray();

  return rows.map((u) => ({
    _id: String(u._id),
    email: String(u.email || ''),
    name: String(u.name || ''),
    school: String(u.school || ''),
    role: String(u.role || ''),
    lockedUntil: String(u.lockedUntil || ''),
    failedLoginCount: Number(u.failedLoginCount || 0),
  }));
}

async function maybeAlertRepeatedFailures(db: Db, email: string) {
  if (!isEmailConfigured()) return;

  const since = new Date(Date.now() - FAILURE_WINDOW_MS).toISOString();
  const count = await db.collection(AUTH_EVENTS_COLLECTION).countDocuments({
    email,
    type: { $in: ['login_failure', 'mfa_failure', 'user_unknown'] },
    at: { $gte: since },
  });
  if (count < FAILURE_ALERT_THRESHOLD) return;

  const alertKey = `auth-failures:${email}`;
  const cooldownSince = new Date(Date.now() - ALERT_COOLDOWN_MS).toISOString();
  const recent = await db.collection('notification_log').findOne({
    key: alertKey,
    sentAt: { $gte: cooldownSince },
  });
  if (recent) return;

  const settings = await getNotificationSettings(db);
  const recipients = await resolveNotificationRecipients(db, settings);
  if (recipients.length === 0) return;

  const appUrl = appBaseUrl();
  const subject = `[Security] Repeated sign-in failures for ${email}`;
  const text = [
    `There were ${count} failed sign-in / MFA attempts for ${email} in the last 15 minutes.`,
    '',
    'Review Admin → Security for details.',
    appUrl ? `${appUrl}/admin/security` : '',
    '',
    'If this is not expected staff activity, reset the password and confirm MFA.',
  ].filter(Boolean).join('\n');

  const result = await sendEmail({ to: recipients, subject, text });
  if (result.ok) {
    await db.collection('notification_log').insertOne({
      key: alertKey,
      sentAt: new Date().toISOString(),
      email,
      count,
    });
  }
}

async function maybeAlertMfaDisabled(db: Db, event: AuthEvent) {
  if (!isEmailConfigured()) return;
  const settings = await getNotificationSettings(db);
  const recipients = await resolveNotificationRecipients(db, settings);
  if (recipients.length === 0) return;

  const by = event.meta?.byEmail ? String(event.meta.byEmail) : 'an Admin';
  const appUrl = appBaseUrl();
  const isBypass = event.meta?.bypass === true;
  await sendEmail({
    to: recipients,
    subject: `[Security] MFA disabled for ${event.email}`,
    text: [
      `MFA was disabled for ${event.email} by ${by}.`,
      '',
      isBypass
        ? 'This account can sign in without an authenticator code until an Admin re-enables MFA. Use only for testing/QA.'
        : 'The user must re-enroll MFA from Profile before password login is fully protected.',
      appUrl ? `${appUrl}/admin/security` : '',
    ].filter(Boolean).join('\n'),
  });
}

async function maybeAlertAccountLocked(db: Db, event: AuthEvent) {
  if (!isEmailConfigured()) return;
  const settings = await getNotificationSettings(db);
  const recipients = await resolveNotificationRecipients(db, settings);
  if (recipients.length === 0) return;

  const minutes = event.meta?.minutes != null ? String(event.meta.minutes) : '30';
  const appUrl = appBaseUrl();
  await sendEmail({
    to: recipients,
    subject: `[Security] Account locked: ${event.email}`,
    text: [
      `The account ${event.email} was temporarily locked after repeated failed sign-in attempts.`,
      event.reason || '',
      '',
      `Lock lasts about ${minutes} minutes, or an Admin can unlock from Users → Security.`,
      appUrl ? `${appUrl}/admin/security` : '',
    ].filter(Boolean).join('\n'),
  });
}

async function maybeAlertUserCreated(db: Db, event: AuthEvent) {
  if (!isEmailConfigured()) return;
  const settings = await getNotificationSettings(db);
  const recipients = await resolveNotificationRecipients(db, settings);
  if (recipients.length === 0) return;

  const by = event.meta?.byEmail ? String(event.meta.byEmail) : 'an Admin';
  const role = event.meta?.role ? String(event.meta.role) : '—';
  const school = event.meta?.school ? String(event.meta.school) : '—';
  const bulkCount = Number(event.meta?.bulkCount || 0);
  const appUrl = appBaseUrl();
  const subject = bulkCount > 1
    ? `[Security] ${bulkCount} users created (bulk upload)`
    : `[Security] New user created: ${event.email}`;
  const text = bulkCount > 1
    ? [
        `${bulkCount} accounts were created via bulk upload by ${by}.`,
        event.reason || '',
        '',
        'Review Admin → Users if this was unexpected.',
        appUrl ? `${appUrl}/admin/users` : '',
      ].filter(Boolean).join('\n')
    : [
        `A new account was created for ${event.email}.`,
        `Role: ${role}`,
        `School: ${school}`,
        `Created by: ${by}`,
        '',
        'If you did not expect this, review Admin → Users and disable or delete the account.',
        appUrl ? `${appUrl}/admin/users` : '',
      ].filter(Boolean).join('\n');
  await sendEmail({ to: recipients, subject, text });
}
