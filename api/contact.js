import { put } from '@vercel/blob';
import nodemailer from 'nodemailer';

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

const SITE = 'https://vivid-vision-works.vercel.app';

const templates = {
  ja: {
    subject: '【Vivid Vision Works】お問い合わせありがとうございます',
    body: (r) => `${r.name} 様

この度はVivid Vision Worksにお問い合わせいただき、誠にありがとうございます。
以下の内容でお問い合わせを受け付けいたしました。
1営業日以内に担当者よりご返信いたしますので、今しばらくお待ちくださいませ。

──────────────────────────
お名前：${r.name}
メールアドレス：${r.email}
ご希望のサービス：${r.services}
お問い合わせ内容：
${r.message}
──────────────────────────

※本メールはシステムによる自動送信です。
※お心当たりのない場合は、お手数ですが本メールを破棄していただきますようお願いいたします。

Vivid Vision Works
Video · 3D CGI · Motion Design — Japan
${SITE}
`,
  },
  en: {
    subject: 'Thanks for your inquiry — Vivid Vision Works',
    body: (r) => `Hi ${r.name.split(' ')[0]},

Thank you for reaching out to Vivid Vision Works. We've received your inquiry below and will get back to you within one business day.

──────────────────────────
Name: ${r.name}
Email: ${r.email}
Services: ${r.services}
Message:
${r.message}
──────────────────────────

This is an automated confirmation. If you didn't submit this inquiry, you can safely disregard this email.

Vivid Vision Works
Video · 3D CGI · Motion Design — Japan
${SITE}
`,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};

  // Honeypot: real visitors never see this field; bots fill it in.
  // Pretend success so bots don't retry.
  if (str(body.company, 10)) {
    return res.status(200).json({ ok: true });
  }

  const record = {
    name: str(body.name, 200),
    email: str(body.email, 200),
    services: str(body.services, 300),
    message: str(body.message, 5000),
    lang: body.lang === 'ja' ? 'ja' : 'en',
    receivedAt: new Date().toISOString(),
    status: 'new',
  };

  if (!record.name || !record.email || !record.message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const stamp = record.receivedAt.slice(0, 19).replace(/[:T]/g, '-');
  const rand = Math.random().toString(36).slice(2, 7);
  await put(`inquiries/${stamp}-${rand}.json`, JSON.stringify(record, null, 2), {
    access: 'private',
    contentType: 'application/json',
  });

  // Auto-reply + studio notification. Activates once GMAIL_USER and
  // GMAIL_APP_PASSWORD are set in Vercel env vars; until then storage-only.
  // Email failure must never fail the submission itself.
  let emailed = false;
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    try {
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
      });
      const t = templates[record.lang];
      await transporter.sendMail({
        from: `"Vivid Vision Works" <${process.env.GMAIL_USER}>`,
        to: record.email,
        subject: t.subject,
        text: t.body(record),
      });
      await transporter.sendMail({
        from: `"VVW Website" <${process.env.GMAIL_USER}>`,
        to: process.env.GMAIL_USER,
        replyTo: `"${record.name.replace(/"/g, '')}" <${record.email}>`,
        subject: `New inquiry — ${record.services || 'General'} — ${record.name}`,
        text: templates.en.body(record),
      });
      emailed = true;
    } catch (err) {
      console.error('auto-reply email failed:', err && err.message);
    }
  }

  return res.status(200).json({ ok: true, emailed });
}
