/**
 * Reusable Frontend API Client
 * Wraps browser fetch with same-origin credentials, automatic JSON serialization,
 * and 401 session expiration handling.
 */
export async function api(url, options = {}, onUnauthorized) {
  const headers = { 'content-type': 'application/json', ...(options.headers || {}) };
  const r = await fetch(url, { ...options, headers, credentials: 'same-origin' });
  const data = await r.json().catch(() => null);

  if (r.status === 401) {
    if (typeof onUnauthorized === 'function') onUnauthorized(data);
    const error = new Error(data?.error || 'Sign in required.');
    error.status = 401;
    throw error;
  }

  if (!r.ok) {
    throw new Error(data?.error || 'Unexpected server response.');
  }

  if (!data) {
    throw new Error('Unexpected server response.');
  }

  return data;
}
