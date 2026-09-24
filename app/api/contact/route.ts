import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

// Fields the client-side scripts use purely as spam honeypots; never forward these.
const HONEYPOT_FIELDS = new Set(['website_hp']);
// The enquiry form on the contact page reuses "website" as its honeypot name.
const HONEYPOT_ONLY_FORMS = new Set(['website']);

function labelize(key: string) {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form submission.' }, { status: 400 });
  }

  const fields: [string, string][] = [];
  const attachments: { filename: string; content: Buffer; contentType?: string }[] = [];

  for (const [key, value] of formData.entries()) {
    if (key === 'g-recaptcha-response') continue;
    if (HONEYPOT_FIELDS.has(key)) {
      if (typeof value === 'string' && value.trim()) {
        return NextResponse.json({ error: 'Spam detected.' }, { status: 400 });
      }
      continue;
    }
    if (HONEYPOT_ONLY_FORMS.has(key) && typeof value === 'string') {
      if (value.trim()) {
        return NextResponse.json({ error: 'Spam detected.' }, { status: 400 });
      }
      continue;
    }

    if (value instanceof File) {
      if (value.size === 0) continue;
      const buffer = Buffer.from(await value.arrayBuffer());
      attachments.push({ filename: value.name, content: buffer, contentType: value.type || undefined });
      continue;
    }

    if (value.trim()) fields.push([key, value]);
  }

  if (fields.length === 0 && attachments.length === 0) {
    return NextResponse.json({ error: 'Empty submission.' }, { status: 400 });
  }

  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  if (secretKey) {
    const token = formData.get('g-recaptcha-response');
    if (typeof token !== 'string' || !token) {
      return NextResponse.json({ error: 'CAPTCHA verification failed.' }, { status: 400 });
    }
    const verifyRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: secretKey, response: token }),
    });
    const verifyJson = await verifyRes.json();
    if (!verifyJson.success) {
      return NextResponse.json({ error: 'CAPTCHA verification failed.' }, { status: 400 });
    }
  }

  const emailField = fields.find(([k]) => k === 'email')?.[1];
  const nameParts = [fields.find(([k]) => k === 'first_name')?.[1], fields.find(([k]) => k === 'last_name')?.[1]]
    .filter(Boolean)
    .join(' ');
  const topic = fields.find(([k]) => k === 'topic' || k === 'enquiry_type')?.[1];
  const pageUrl = req.headers.get('referer') || 'unknown page';

  const subject = `New website enquiry${topic ? ` — ${topic}` : ''}${nameParts ? ` from ${nameParts}` : ''}`;
  const textBody =
    fields.map(([k, v]) => `${labelize(k)}: ${v}`).join('\n') +
    `\n\nSubmitted from: ${pageUrl}` +
    (attachments.length ? `\nAttachments: ${attachments.map((a) => a.filename).join(', ')}` : '');

  const port = Number(process.env.SMTP_PORT || 465);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  try {
    await transporter.sendMail({
      from: `"Cosmetic Science Lab Website" <${process.env.SMTP_USER}>`,
      to: process.env.MAIL_TO,
      replyTo: emailField || undefined,
      subject,
      text: textBody,
      attachments,
    });
  } catch (err) {
    console.error('Failed to send enquiry email:', err);
    return NextResponse.json({ error: 'Could not send email.' }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
