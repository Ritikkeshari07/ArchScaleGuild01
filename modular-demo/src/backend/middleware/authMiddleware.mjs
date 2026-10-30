/**
 * Authentication Middleware
 * Manages JWT session tokens, cookies, and fast local payload decoding.
 */
import { supabaseRequest } from '../database/supabaseClient.mjs';

export function decodeJwt(token) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (!payload || !payload.sub) return null;
    if (payload.exp && payload.exp < (Date.now() / 1000) + 10) return null;
    return payload;
  } catch {
    return null;
  }
}

export function parseCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(';').map(part => {
    const index = part.indexOf('=');
    if (index < 0) return ['', ''];
    const name = part.slice(0, index).trim();
    try { return [name, decodeURIComponent(part.slice(index + 1).trim())]; }
    catch { return [name, '']; }
  }).filter(([name]) => name));
}

export function cookieHeaders(req, session) {
  const secure = req.socket?.encrypted || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
  const common = `; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
  const accessAge = Math.max(60, Math.min(Number(session.expires_in) || 3600, 3600));
  return {
    'set-cookie': [
      `archscale_access=${encodeURIComponent(session.access_token)}; Max-Age=${accessAge}${common}`,
      `archscale_refresh=${encodeURIComponent(session.refresh_token)}; Max-Age=2592000${common}`
    ]
  };
}

export function clearAuthCookies(req) {
  const secure = req.socket?.encrypted || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
  const common = `; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
  return { 'set-cookie': [`archscale_access=${common}`, `archscale_refresh=${common}`] };
}

const userCache = new Map();

export async function currentUser(token) {
  if (!token) throw Object.assign(new Error('Sign in required.'), { status: 401 });
  const payload = decodeJwt(token);
  if (payload) {
    return { id: payload.sub, email: payload.email, user_metadata: payload.user_metadata || {} };
  }
  const hit = userCache.get(token);
  if (hit && Date.now() - hit.ts < 60_000) return hit.user;
  const user = await supabaseRequest('/auth/v1/user', { token });
  userCache.set(token, { user, ts: Date.now() });
  if (userCache.size > 500) userCache.clear();
  return user;
}

export function bearer(req) {
  const value = req.headers.authorization || '';
  return value.startsWith('Bearer ') ? value.slice(7) : '';
}

export async function sessionFor(req, res) {
  const jar = parseCookies(req);
  let token = bearer(req) || jar.archscale_access || '';
  if (!token) throw Object.assign(new Error('Sign in required.'), { status: 401 });

  try {
    return { user: await currentUser(token), token };
  } catch (error) {
    if (error.status !== 401 || !jar.archscale_refresh) {
      if (error.status === 401) res.setHeader('set-cookie', clearAuthCookies(req)['set-cookie']);
      throw error;
    }
  }

  try {
    const refreshed = await supabaseRequest('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      body: { refresh_token: jar.archscale_refresh }
    });
    if (!refreshed?.access_token || !refreshed?.refresh_token) {
      throw Object.assign(new Error('Session expired. Sign in again.'), { status: 401 });
    }
    res.setHeader('set-cookie', cookieHeaders(req, refreshed)['set-cookie']);
    return { user: refreshed.user, token: refreshed.access_token };
  } catch {
    res.setHeader('set-cookie', clearAuthCookies(req)['set-cookie']);
    throw Object.assign(new Error('Session expired. Sign in again.'), { status: 401 });
  }
}
