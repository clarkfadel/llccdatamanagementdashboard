import crypto from 'node:crypto';
import { Router } from 'express';

// simple login, one account from .env
const USERNAME = process.env.APP_USERNAME || 'admin';
const PASSWORD = process.env.APP_PASSWORD || 'llcc';
const SECRET = process.env.APP_SECRET || 'dev-insecure-secret-change-me';
const TTL_MS = 12 * 60 * 60 * 1000; // 12h

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${mac}`;
}

function verify(token) {
  if (!token || !token.includes('.')) return null;
  const [body, mac] = token.split('.');
  const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  if (mac.length !== expected.length
      || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}

export const auth = Router();

auth.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username !== USERNAME || password !== PASSWORD) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  const token = sign({ u: username, exp: Date.now() + TTL_MS });
  res.json({ token, user: { name: username } });
});

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = verify(token);
  if (!payload) return res.status(401).json({ error: 'Not authenticated' });
  req.user = { name: payload.u };
  next();
}
