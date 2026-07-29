import nodemailer from 'nodemailer';

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
};

export function isEmailConfigured(): boolean {
  return Boolean(process.env.EMAIL_SERVER && process.env.EMAIL_FROM);
}

export async function sendEmail(input: SendEmailInput): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  if (!isEmailConfigured()) {
    console.warn('[email] Skipped — set EMAIL_SERVER and EMAIL_FROM');
    return { ok: false, skipped: true, error: 'Email is not configured (EMAIL_SERVER / EMAIL_FROM).' };
  }

  const to = Array.isArray(input.to) ? input.to.filter(Boolean) : [input.to].filter(Boolean);
  if (to.length === 0) {
    return { ok: false, error: 'No recipients' };
  }

  try {
    const transporter = nodemailer.createTransport(process.env.EMAIL_SERVER);
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: to.join(', '),
      subject: input.subject,
      text: input.text,
      html: input.html || input.text.replace(/\n/g, '<br/>'),
    });
    return { ok: true };
  } catch (err) {
    console.error('[email] send failed', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to send email',
    };
  }
}
