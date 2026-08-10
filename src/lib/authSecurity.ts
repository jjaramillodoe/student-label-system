import type { Db } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { getAuthRequest, getClientIp, getClientUserAgent } from '@/lib/authRequestContext';
import {
  getNotificationSettings,
  resolveNotificationRecipients,
} from '@/lib/notifications';
import { isEmailConfigured, sendEmail } from '@/lib/email';

export const AUTH_EVENTS_COLLECTION = 'auth_events';

export type AuthEventType =
  | 'login_failure'
  | 'login_success'
  | 'mfa_failure'
  | 'mfa_disabled'
  | 'user_unknown';

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

export async function logAuthEvent(input: {
  type: AuthEventType;
  email: string;
  reason?: string;
  meta?: Record<string, unknown>;
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
  } catch (err) {
    console.error('[authSecurity] logAuthEvent failed', err);
  }
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

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || '').replace(/\/$/, '');
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
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || '').replace(/\/$/, '');
  await sendEmail({
    to: recipients,
    subject: `[Security] MFA disabled for ${event.email}`,
    text: [
      `MFA was disabled for ${event.email} by ${by}.`,
      '',
      'The user must re-enroll MFA from Profile before password login is fully protected.',
      appUrl ? `${appUrl}/admin/security` : '',
    ].filter(Boolean).join('\n'),
  });
}
