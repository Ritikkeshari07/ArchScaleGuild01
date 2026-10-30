/**
 * Supabase Database & Auth Client Gateway
 * Manages low-latency HTTP communication with Supabase PostgREST, Auth, and Stored Procedures.
 */
const apiUrl = (process.env.SUPABASE_URL || (process.env.VERCEL ? '' : 'http://127.0.0.1:54321')).replace(/\/$/, '');
const apiKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;

export async function supabaseRequest(pathname, { token, method = 'GET', body, prefer, schema } = {}) {
  if (!apiUrl) throw Object.assign(new Error('Set SUPABASE_URL in the deployment environment.'), { status: 503 });
  if (!apiKey) throw Object.assign(new Error('Set SUPABASE_PUBLISHABLE_KEY in the deployment environment.'), { status: 503 });

  const headers = { apikey: apiKey, 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (prefer) headers.prefer = prefer;
  if (schema) headers[method === 'GET' ? 'accept-profile' : 'content-profile'] = schema;

  const response = await fetch(`${apiUrl}${pathname}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const error = new Error(data?.message || data?.msg || data?.error_description || `Supabase request failed (${response.status}).`);
    error.status = response.status === 401 ? 401 : response.status === 403 ? 403 : 400;
    throw error;
  }

  return data;
}

export const getRows = (table, orgId, token, extra = '', schema) =>
  supabaseRequest(`/rest/v1/${table}?select=*&organization_id=eq.${encodeURIComponent(orgId)}${extra}`, { token, schema });
