import { NextRequest, NextResponse } from 'next/server';
import { sendMail, missingMailSettings, type MailAttachment } from '@/lib/mail';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Spam traps. "website_hp" is a dedicated hidden field (supplier/partner forms). The main
// enquiry form has no real website field, so there "website" is the trap; on the other forms
// "website" is a real "Company website" answer and must be forwarded.
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

// A form may choose its recipient with a hidden "to" field, but only from this list;
// otherwise anyone could post a form and make the server email an arbitrary address.
const ALLOWED_TO = new Set(['careers@guires.com']);

const labelize = (key: string) => key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const bad = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return bad('Invalid form submission.', 400);
  }

  const hasDedicatedTrap = formData.has('website_hp');
  const fields: [string, string][] = [];
  const attachments: MailAttachment[] = [];

  for (const [key, value] of formData.entries()) {
    if (key === 'to') continue;

    if (key === 'website_hp' || (!hasDedicatedTrap && key === 'website')) {
      if (typeof value === 'string' && value.trim()) return bad('Spam detected.', 400);
      continue;
    }

    if (value instanceof File) {
      if (value.size === 0) continue;
      if (value.size > MAX_ATTACHMENT_BYTES) return bad('Attachment too large (10 MB maximum).', 413);
      attachments.push({ filename: value.name, content: Buffer.from(await value.arrayBuffer()), contentType: value.type || undefined });
      continue;
    }

    if (value.trim()) fields.push([key, value.trim()]);
  }

  if (fields.length === 0 && attachments.length === 0) return bad('Empty submission.', 400);

  const get = (...keys: string[]) => fields.find(([k]) => keys.includes(k))?.[1];
  const email = get('email');
  const name = [get('first_name'), get('last_name')].filter(Boolean).join(' ');
  const topic = get('topic', 'enquiry_type');
  const requestedTo = formData.get('to');
  const to = typeof requestedTo === 'string' && ALLOWED_TO.has(requestedTo.trim().toLowerCase())
    ? requestedTo.trim().toLowerCase()
    : undefined;   // undefined = default recipients (MAIL_TO)

  const subject = `New website enquiry${topic ? ` — ${topic}` : ''}${name ? ` from ${name}` : ''}`;
  const text =
    fields.map(([k, v]) => `${labelize(k)}: ${v}`).join('\n') +
    `\n\nSubmitted from: ${req.headers.get('referer') || 'unknown page'}` +
    (attachments.length ? `\nAttachments: ${attachments.map((a) => a.filename).join(', ')}` : '');

  const missing = missingMailSettings();
  if (missing.length) {
    console.error('Mail is not configured. Missing environment variables:', missing.join(', '));
    return bad('Could not send. Please email info@cosmeticsciencelab.com.', 503);
  }

  try {
    await sendMail({ subject, text, to, replyTo: email, attachments });
  } catch (err) {
    console.error('Failed to send enquiry email:', err);
    return bad('Could not send. Please email info@cosmeticsciencelab.com.', 502);
  }
  return NextResponse.json({ ok: true });
}
