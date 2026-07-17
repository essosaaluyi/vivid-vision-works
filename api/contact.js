import { put } from '@vercel/blob';

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

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

  return res.status(200).json({ ok: true });
}
