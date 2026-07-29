import type { Db } from 'mongodb';
import { sendEmail, isEmailConfigured } from '@/lib/email';

export type NotificationSettings = {
  notifyLowStockEmail: boolean;
  notifyIntakeIssuesEmail: boolean;
  /** Comma-separated emails. Empty = all Admin + Data Lead users. */
  notificationRecipients: string;
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  notifyLowStockEmail: true,
  notifyIntakeIssuesEmail: true,
  notificationRecipients: '',
};

const APP_URL = () =>
  (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '');

export async function getNotificationSettings(db: Db): Promise<NotificationSettings> {
  const doc = await db.collection('app_settings').findOne({ key: 'global' });
  return {
    notifyLowStockEmail:
      typeof doc?.notifyLowStockEmail === 'boolean'
        ? doc.notifyLowStockEmail
        : DEFAULT_NOTIFICATION_SETTINGS.notifyLowStockEmail,
    notifyIntakeIssuesEmail:
      typeof doc?.notifyIntakeIssuesEmail === 'boolean'
        ? doc.notifyIntakeIssuesEmail
        : DEFAULT_NOTIFICATION_SETTINGS.notifyIntakeIssuesEmail,
    notificationRecipients:
      typeof doc?.notificationRecipients === 'string'
        ? doc.notificationRecipients
        : DEFAULT_NOTIFICATION_SETTINGS.notificationRecipients,
  };
}

export async function resolveNotificationRecipients(
  db: Db,
  settings?: NotificationSettings,
): Promise<string[]> {
  const cfg = settings ?? (await getNotificationSettings(db));
  const explicit = cfg.notificationRecipients
    .split(/[,;\s]+/)
    .map(e => e.trim().toLowerCase())
    .filter(e => e.includes('@'));

  if (explicit.length > 0) return [...new Set(explicit)];

  const users = await db
    .collection('users')
    .find({ role: { $in: ['Admin', 'Data Lead'] } })
    .project({ email: 1 })
    .toArray();

  return [
    ...new Set(
      users
        .map(u => (typeof u.email === 'string' ? u.email.toLowerCase() : ''))
        .filter(Boolean),
    ),
  ];
}

/** Avoid spamming the same low-stock alert more than once per day per template. */
async function shouldSendLowStockAlert(db: Db, template: string): Promise<boolean> {
  const key = `low-stock:${template}`;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const recent = await db.collection('notification_log').findOne({
    key,
    sentAt: { $gte: since },
  });
  return !recent;
}

async function logNotification(db: Db, key: string, meta?: Record<string, unknown>) {
  await db.collection('notification_log').insertOne({
    key,
    sentAt: new Date().toISOString(),
    ...meta,
  });
}

export async function maybeNotifyLowStock(
  db: Db,
  stock: {
    template?: string;
    currentStock?: number;
    lowStockThreshold?: number;
  },
): Promise<{ sent: boolean; reason?: string }> {
  const settings = await getNotificationSettings(db);
  if (!settings.notifyLowStockEmail) {
    return { sent: false, reason: 'Low-stock email notifications are disabled.' };
  }
  if (!isEmailConfigured()) {
    return { sent: false, reason: 'Email is not configured.' };
  }

  const current = Number(stock.currentStock ?? 0);
  const threshold = Number(stock.lowStockThreshold ?? 0);
  const template = String(stock.template || 'unknown');
  if (!(threshold > 0) || current > threshold) {
    return { sent: false, reason: 'Stock is above threshold.' };
  }

  if (!(await shouldSendLowStockAlert(db, template))) {
    return { sent: false, reason: 'Already notified for this template in the last 24 hours.' };
  }

  const recipients = await resolveNotificationRecipients(db, settings);
  if (recipients.length === 0) {
    return { sent: false, reason: 'No notification recipients found.' };
  }

  const url = `${APP_URL()}/admin/label-stock`;
  const result = await sendEmail({
    to: recipients,
    subject: `[Student Label System] Low stock: ${template}`,
    text: [
      `Label stock is low for template: ${template}`,
      `Current stock: ${current}`,
      `Low-stock threshold: ${threshold}`,
      '',
      `Review and reorder: ${url}`,
    ].join('\n'),
  });

  if (!result.ok) {
    return { sent: false, reason: result.error || 'Send failed' };
  }

  await logNotification(db, `low-stock:${template}`, { template, current, threshold, recipients });
  return { sent: true };
}

export async function sendIntakeIssuesDigest(
  db: Db,
  issues: Array<{ studentName?: string; school?: string; issues?: string[] }>,
): Promise<{ sent: boolean; reason?: string; recipientCount?: number }> {
  const settings = await getNotificationSettings(db);
  if (!settings.notifyIntakeIssuesEmail) {
    return { sent: false, reason: 'Intake-issues email notifications are disabled.' };
  }
  if (!isEmailConfigured()) {
    return { sent: false, reason: 'Email is not configured.' };
  }
  if (issues.length === 0) {
    return { sent: false, reason: 'No intake issues to report.' };
  }

  const recipients = await resolveNotificationRecipients(db, settings);
  if (recipients.length === 0) {
    return { sent: false, reason: 'No notification recipients found.' };
  }

  const lines = issues.slice(0, 40).map((item, i) => {
    const name = item.studentName || 'Unknown student';
    const school = item.school ? ` (${item.school})` : '';
    const detail = (item.issues || []).join('; ') || 'Needs review';
    return `${i + 1}. ${name}${school} — ${detail}`;
  });

  const url = `${APP_URL()}/intake`;
  const result = await sendEmail({
    to: recipients,
    subject: `[Student Label System] ${issues.length} intake issue(s) need review`,
    text: [
      `${issues.length} intake time/handoff issue(s) need attention.`,
      '',
      ...lines,
      issues.length > 40 ? `\n…and ${issues.length - 40} more.` : '',
      '',
      `Open Intake to fix: ${url}`,
    ]
      .filter(Boolean)
      .join('\n'),
  });

  if (!result.ok) {
    return { sent: false, reason: result.error || 'Send failed', recipientCount: recipients.length };
  }

  await logNotification(db, 'intake-issues-digest', {
    count: issues.length,
    recipients,
  });
  return { sent: true, recipientCount: recipients.length };
}

export async function sendTestNotificationEmail(to: string) {
  return sendEmail({
    to,
    subject: '[Student Label System] Test notification',
    text: [
      'This is a test email from the Student Label System.',
      `App URL: ${APP_URL()}`,
      '',
      'If you received this, EMAIL_SERVER / EMAIL_FROM are working.',
    ].join('\n'),
  });
}
