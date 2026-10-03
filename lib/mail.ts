import nodemailer from 'nodemailer';

export type MailAttachment = { filename: string; content: Buffer; contentType?: string };

const REQUIRED = ['SMTP_USER', 'SMTP_PASS', 'MAIL_TO'] as const;

/** Names of required environment variables that are missing (never their values). */
export function missingMailSettings(): string[] {
  return REQUIRED.filter((k) => !process.env[k]?.trim());
}

function list(v: string | undefined): string[] {
  return (v ?? '').split(/[,;]/).map((s) => s.trim()).filter(Boolean);
}

/**
 * Sends one email through the SMTP account in the environment settings.
 * Defaults: smtp.gmail.com, port 465, SSL. App passwords pasted with spaces are accepted.
 * Throws if no recipient was accepted by the server.
 */
export async function sendMail(opts: {
  subject: string;
  text: string;
  to?: string;
  replyTo?: string;
  attachments?: MailAttachment[];
}) {
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER!.trim();
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST?.trim() || 'smtp.gmail.com',
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE.trim() === 'true' : port === 465,
    auth: { user, pass: process.env.SMTP_PASS!.replace(/\s+/g, '') },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 25_000,
  });

  const to = list(opts.to ?? process.env.MAIL_TO);
  const info = await transporter.sendMail({
    from: { name: 'Cosmetic Science Lab Website', address: user },
    to,
    replyTo: opts.replyTo || undefined,
    subject: opts.subject,
    text: opts.text,
    attachments: opts.attachments,
  });

  console.log('Mail sent', { subject: opts.subject, to, accepted: info.accepted, rejected: info.rejected, response: info.response });
  if (!info.accepted || info.accepted.length === 0) throw new Error('SMTP server accepted no recipients');
  return { accepted: info.accepted as string[], rejected: info.rejected as string[] };
}
