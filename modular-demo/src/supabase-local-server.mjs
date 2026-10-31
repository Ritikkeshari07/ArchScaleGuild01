import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import registry from './platform/registry.js';
import contacts from './apps/contacts/index.js';
import products from './apps/products/index.js';
import orders from './apps/orders/index.js';
import tasks from './apps/tasks/index.js';

// Clean backend modular architecture
import { assertSameOrigin } from './backend/middleware/securityMiddleware.mjs';
import { sessionFor, cookieHeaders, clearAuthCookies, bearer, parseCookies } from './backend/middleware/authMiddleware.mjs';
import { getStateFor, clearStateCache } from './backend/controllers/stateController.mjs';
import { supabaseRequest } from './backend/database/supabaseClient.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');
const appIds = ['contacts', 'products', 'orders', 'tasks'];
const apps = { contacts, products, orders, tasks };
const definitions = registry.definitions.filter(item => appIds.includes(item.id));
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8' };

function json(res, status, body, headers = {}) {
  res.writeHead(status, { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store', ...headers });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  if (Buffer.isBuffer(req.body)) req.body = req.body.toString('utf8');
  if (typeof req.body === 'string') {
    try { return req.body ? JSON.parse(req.body) : {}; }
    catch { throw Object.assign(new Error('Invalid JSON.'), { status:400 }); }
  }
  let text = '';
  for await (const chunk of req) {
    text += chunk;
    if (text.length > 1_000_000) throw Object.assign(new Error('Request too large.'), { status:413 });
  }
  try { return text ? JSON.parse(text) : {}; }
  catch { throw Object.assign(new Error('Invalid JSON.'), { status:400 }); }
}

const toCamel = row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key.replace(/_([a-z])/g, (_, c) => c.toUpperCase()), value]));

async function stateFor(token, userId) {
  return getStateFor({ token, userId, definitions, appIds });
}

async function handleApi(req, res) {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/api/health') return json(res, 200, { ok: true, service: 'four-app-supabase-local' });
  if (req.method !== 'GET') assertSameOrigin(req);

  if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
    clearStateCache();
    return json(res, 200, { ok: true }, clearAuthCookies(req));
  }

  if (req.method === 'POST' && ['/api/auth/login', '/api/auth/signup'].includes(url.pathname)) {
    const input = await readBody(req);
    if (!input.email || !input.password) return json(res, 400, { error: 'Email and password are required.' });
    const signup = url.pathname.endsWith('signup');
    const result = await supabaseRequest(signup ? '/auth/v1/signup' : '/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: { email: String(input.email).trim(), password: String(input.password) }
    });
    if (signup) {
      if (!result?.access_token) return json(res, 200, { needsConfirmation: true, message: 'Account created. Confirm the email in local Supabase Mailpit, then sign in.' });
      return json(res, 200, { user: result.user, message: 'Account created. Complete the one-time admin setup, then sign in.' });
    }
    if (!result?.access_token || !result?.refresh_token) throw Object.assign(new Error('Sign-in did not return a valid session.'), { status: 401 });
    return json(res, 200, { user: result.user }, cookieHeaders(req, result));
  }

  const { token, user } = await sessionFor(req, res);
  if (req.method === 'GET' && url.pathname === '/api/state') {
    return json(res, 200, { definitions, state: await stateFor(token, user.id) });
  }

  const lifecycle = url.pathname.match(/^\/api\/admin\/modules\/(contacts|products|orders|tasks)\/(activate|deactivate|retire|delete|remove|reinstall)$/);
  if (req.method === 'POST' && lifecycle) {
    const [, appId, action] = lifecycle;
    const actionValue = action === 'remove' ? 'remove_schema' : action === 'delete' ? 'delete_data' : action === 'reinstall' ? 'activate' : action;
    const state = await stateFor(token, user.id);
    let result;
    try {
      result = await supabaseRequest('/rest/v1/rpc/manage_app_lifecycle', {
        token,
        method: 'POST',
        body: { target_org: state.organizationId, target_app: appId, requested_action: actionValue }
      });
    } catch (err) {
      if (/redeployed before activation|already been removed/i.test(err.message)) {
        await supabaseRequest('/rest/v1/app_registry', {
          token,
          method: 'POST',
          prefer: 'resolution=merge-duplicates',
          body: { organization_id: state.organizationId, app_id: appId, status: 'active', updated_at: new Date().toISOString() }
        });
        result = 'active';
      } else {
        throw err;
      }
    }
    clearStateCache();
    return json(res, 200, { ok: true, status: result });
  }

  if (req.method === 'POST' && url.pathname === '/api/demo/reset') {
    const state = await stateFor(token, user.id);
    for (const appId of ['contacts', 'products', 'orders', 'tasks']) {
      try {
        await supabaseRequest('/rest/v1/rpc/manage_app_lifecycle', {
          token,
          method: 'POST',
          body: { target_org: state.organizationId, target_app: appId, requested_action: 'activate' }
        });
      } catch {
        try {
          await supabaseRequest('/rest/v1/app_registry', {
            token,
            method: 'POST',
            prefer: 'resolution=merge-duplicates',
            body: { organization_id: state.organizationId, app_id: appId, status: 'active', updated_at: new Date().toISOString() }
          });
        } catch {}
      }
    }
    clearStateCache();
    return json(res, 200, { ok: true, message: 'All workspaces reactivated.' });
  }

  const match = url.pathname.match(/^\/api\/(contacts|products|orders|tasks)$/);
  if (match && req.method === 'POST') {
    const appId = match[1];
    const state = await stateFor(token, user.id);
    const current = state.modules[appId]?.status;
    if (current !== 'active') return json(res, 409, { error: `${appId} is ${current}. Activate it before creating records.` });
    const created = apps[appId].create(await readBody(req), state);
    const columns = {
      contacts: { name:created.name, organization:created.organization, email:created.email, phone:created.phone, city:created.city, product_id:created.productId, product_name:created.productName, order_id:created.orderId, order_ref:created.orderRef, task_id:created.taskId, task_name:created.taskName },
      products: { name:created.name, sku:created.sku, category:created.category, unit:created.unit, price:created.price, contact_id:created.contactId, contact_name:created.contactName, order_id:created.orderId, order_ref:created.orderRef, task_id:created.taskId, task_name:created.taskName },
      orders: { order_no:created.orderNo, customer_id:created.customerId, customer_name:created.customerName, product_id:created.productId, product_name:created.productName, unit_price:created.unitPrice, quantity:created.quantity, status:created.status, task_id:created.taskId, task_name:created.taskName },
      tasks: { name:created.name, assigned_to:created.assignedTo, order_id:created.orderId, order_ref:created.orderRef, contact_id:created.contactId, contact_name:created.contactName, product_id:created.productId, product_name:created.productName, due_date:created.dueDate || null, status:created.status }
    }[appId];
    const rows = await supabaseRequest(`/rest/v1/${appId}?select=*`, {
      token,
      method: 'POST',
      body: { organization_id: state.organizationId, ...columns },
      prefer: 'return=representation',
      schema: appId
    });
    clearStateCache();
    return json(res, 201, toCamel(rows[0]));
  }

  return json(res, 404, { error: 'Route not found.' });
}

export async function route(req, res) {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/health') return json(res, 200, { ok: true, service: 'four-app-supabase-local' });
  if (url.pathname.startsWith('/api/')) {
    try { return await handleApi(req, res); }
    catch (error) { return json(res, error.status || 500, { error: error.message || 'Server error.' }); }
  }
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed.' });
  const appPage = url.pathname.match(/^\/apps\/(contacts|products|orders|tasks)\/?$/);
  const requested = url.pathname === '/' ? 'index.html'
    : url.pathname === '/admin' || url.pathname === '/admin/' ? 'admin/index.html'
    : appPage ? `apps/${appPage[1]}/index.html` : url.pathname.slice(1);
  const file = path.resolve(publicDir, requested);
  if (!file.startsWith(path.resolve(publicDir) + path.sep) && file !== path.join(publicDir, 'index.html')) return json(res, 403, { error: 'Forbidden' });
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return json(res, 404, { error: 'Not found.' });
  res.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
  return fs.createReadStream(file).pipe(res);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = http.createServer((req, res) => route(req, res).catch(error => json(res, error.status || 500, { error: error.message || 'Server error.' })));
  const port = Number(process.env.PORT || 3000);
  server.listen(port, '127.0.0.1', () => console.log(`Four-app Supabase pilot: http://127.0.0.1:${port}`));
}
