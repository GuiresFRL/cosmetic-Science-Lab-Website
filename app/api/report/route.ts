import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import nodemailer from 'nodemailer';

export const runtime = 'nodejs';
const MAX_FILES = 3, MAX_BYTES = 5 * 1024 * 1024, IMG = ['image/jpeg', 'image/png', 'image/webp'];
const clip = (v: FormDataEntryValue | null, n = 500) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

export async function POST(req: Request) {
  let fd: FormData;
  try { fd = await req.formData(); } catch { return NextResponse.json({ error: 'Invalid form data' }, { status: 400 }); }
  if (clip(fd.get('website'))) return NextResponse.json({ reference: 'CSL-RPT-0' });            // honeypot: silently accept bots
  const anonymous = fd.get('anonymous') === 'yes';
  const problems = fd.getAll('problem_type').map(v => clip(v, 80)).filter(Boolean);
  const email = anonymous ? '' : clip(fd.get('email'), 200);
  const missing = [
    ['product_name', clip(fd.get('product_name'))], ['brand', clip(fd.get('brand'))], ['purchase_country', clip(fd.get('purchase_country'))],
    ['description', clip(fd.get('description'), 5000)], ['residence_country', clip(fd.get('residence_country'))],
  ].filter(([, v]) => !v).map(([k]) => k);
  if (!problems.length) missing.push('problem_type');
  if (fd.get('consent_processing') !== 'yes') missing.push('consent_processing');
  if (!anonymous && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) missing.push('email');
  if (missing.length) return NextResponse.json({ error: 'Missing or invalid fields', fields: missing }, { status: 422 });

  const files = fd.getAll('photos').filter((f): f is File => typeof f !== 'string' && f.size > 0);
  if (files.length > MAX_FILES || files.some(f => f.size > MAX_BYTES || !IMG.includes(f.type)))
    return NextResponse.json({ error: 'Up to 3 JPEG, PNG or WebP images, 5 MB each' }, { status: 422 });
  const attachments = await Promise.all(files.map(async f => ({ filename: f.name.slice(0, 120), content: Buffer.from(await f.arrayBuffer()), contentType: f.type })));

  const now = new Date();
  const reference = `CSL-RPT-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const medical = clip(fd.get('medical_help'));
  const serious = medical === 'Hospital or emergency care';
  const brand = clip(fd.get('brand')), product = clip(fd.get('product_name'));

  const lines: [string, string][] = [
    ['Reference', reference], ['Received', now.toISOString()], ['Brand', brand], ['Product', product],
    ['Product type', clip(fd.get('product_type'))], ['Batch', clip(fd.get('batch'), 100)],
    ['Purchased in', clip(fd.get('purchase_country'))], ['Purchase channel', clip(fd.get('purchase_channel'))],
    ['Problem type(s)', problems.join(', ')], ['Description', clip(fd.get('description'), 5000)],
    ['Date noticed', clip(fd.get('date_noticed'), 10)], ['Medical help sought', medical],
    ['Anonymous', anonymous ? 'yes' : 'no'], ['Name', anonymous ? '' : clip(fd.get('name'), 200)], ['Email', email],
    ['Country of residence', clip(fd.get('residence_country'))],
    ['Consent: processing', 'yes'], ['Consent: share with brand', fd.get('consent_share') === 'yes' ? 'yes' : 'no'],
    ['Consent: may contact', !anonymous && fd.get('consent_contact') === 'yes' ? 'yes' : 'no'],
  ];
  const text = lines.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n') + (attachments.length ? `\nPhotos attached: ${attachments.length}` : '');

  const port = Number(process.env.SMTP_PORT || 465);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  try {
    const info = await transporter.sendMail({
      from: `"Cosmetic Science Lab Website" <${process.env.SMTP_USER}>`,
      to: process.env.MAIL_TO,
      replyTo: email || undefined,
      subject: `${serious ? 'URGENT: possible serious effect. ' : ''}Product problem report ${reference}: ${brand} ${product}`,
      text, attachments,
    });
    console.log('Product report email sent', { reference, accepted: info.accepted, rejected: info.rejected });
    if (!info.accepted || info.accepted.length === 0) return NextResponse.json({ error: 'Could not send report' }, { status: 502 });
  } catch (e) {
    console.error('Failed to send product report email:', e);
    return NextResponse.json({ error: 'Could not send report' }, { status: 502 });
  }
  return NextResponse.json({ reference }, { status: 201 });
}
