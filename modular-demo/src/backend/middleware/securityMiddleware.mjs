/**
 * Security Middleware
 * Protects against cross-origin request forgery (CSRF) by enforcing strict origin matches.
 */
export function assertSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return;
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const expected = `${forwardedProto || (req.socket?.encrypted ? 'https' : 'http')}://${req.headers.host}`;
  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    throw Object.assign(new Error('Invalid request origin.'), { status: 403 });
  }
  if (parsed.origin !== expected) {
    throw Object.assign(new Error('Cross-origin request blocked.'), { status: 403 });
  }
}
