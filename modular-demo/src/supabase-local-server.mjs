import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import registry from './platform/registry.js';
import contacts from './apps/contacts/index.js';
import products from './apps/products/index.js';
import orders from './apps/orders/index.js';
import tasks from './apps/tasks/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');
const apiUrl = (process.env.SUPABASE_URL || (process.env.VERCEL ? '' : 'http://127.0.0.1:54321')).replace(/\/$/, '');
const apiKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
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

function bearer(req) {
  const value = req.headers.authorization || '';
  return value.startsWith('Bearer ') ? value.slice(7) : '';
}

function cookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(';').map(part => {
    const index = part.indexOf('=');
    if (index < 0) return ['', ''];
    const name = part.slice(0, index).trim();
    try { return [name, decodeURIComponent(part.slice(index + 1).trim())]; }
    catch { return [name, '']; }
  }).filter(([name]) => name));
}

function cookieHeaders(req, session) {
  const secure = req.socket.encrypted || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
  const common = `; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
  const accessAge = Math.max(60, Math.min(Number(session.expires_in) || 3600, 3600));
  return { 'set-cookie': [
    `archscale_access=${encodeURIComponent(session.access_token)}; Max-Age=${accessAge}${common}`,
    `archscale_refresh=${encodeURIComponent(session.refresh_token)}; Max-Age=2592000${common}`
  ] };
}

function clearAuthCookies(req) {
  const secure = req.socket.encrypted || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
  const common = `; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
  return { 'set-cookie': [`archscale_access=${common}`, `archscale_refresh=${common}`] };
}

function assertSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return;
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const expected = `${forwardedProto || (req.socket.encrypted ? 'https' : 'http')}://${req.headers.host}`;
  let parsed;
  try { parsed = new URL(origin); }
  catch { throw Object.assign(new Error('Invalid request origin.'), { status:403 }); }
  if (parsed.origin !== expected) throw Object.assign(new Error('Cross-origin request blocked.'), { status:403 });
}

async function supabase(pathname, { token, method='GET', body, prefer, schema } = {}) {
  if (!apiUrl) throw Object.assign(new Error('Set SUPABASE_URL in the deployment environment.'), { status:503 });
  if (!apiKey) throw Object.assign(new Error('Set SUPABASE_PUBLISHABLE_KEY in the deployment environment.'), { status:503 });
  const headers = { apikey:apiKey, 'content-type':'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (prefer) headers.prefer = prefer;
  if (schema) headers[method === 'GET' ? 'accept-profile' : 'content-profile'] = schema;
  const response = await fetch(`${apiUrl}${pathname}`, {
    method, headers, ...(body === undefined ? {} : { body:JSON.stringify(body) })
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const error = new Error(data?.message || data?.msg || data?.error_description || `Supabase request failed (${response.status}).`);
    error.status = response.status === 401 ? 401 : response.status === 403 ? 403 : 400;
    throw error;
  }
  return data;
}

async function currentUser(token) {
  if (!token) throw Object.assign(new Error('Sign in required.'), { status:401 });
  return supabase('/auth/v1/user', { token });
}

async function sessionFor(req, res) {
  const jar = cookies(req);
  let token = bearer(req) || jar.archscale_access || '';
  if (!token) throw Object.assign(new Error('Sign in required.'), { status:401 });
  try { return { user: await currentUser(token), token }; }
  catch (error) {
    if (error.status !== 401 || !jar.archscale_refresh) {
      if (error.status === 401) res.setHeader('set-cookie', clearAuthCookies(req)['set-cookie']);
      throw error;
    }
  }
  try {
    const refreshed = await supabase('/auth/v1/token?grant_type=refresh_token', {
      method:'POST', body:{ refresh_token:jar.archscale_refresh }
    });
    if (!refreshed?.access_token || !refreshed?.refresh_token) throw Object.assign(new Error('Session expired. Sign in again.'), { status:401 });
    res.setHeader('set-cookie', cookieHeaders(req, refreshed)['set-cookie']);
    return { user:refreshed.user, token:refreshed.access_token };
  } catch (error) {
    res.setHeader('set-cookie', clearAuthCookies(req)['set-cookie']);
    throw Object.assign(new Error('Session expired. Sign in again.'), { status:401 });
  }
}

const getRows = (table, orgId, token, extra='', schema) =>
  supabase(`/rest/v1/${table}?select=*&organization_id=eq.${encodeURIComponent(orgId)}${extra}`, { token, schema });

const toCamel = row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key.replace(/_([a-z])/g, (_, c) => c.toUpperCase()), value]));
const toSnake = row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`), value]));

async function stateFor(token, userId) {
  const memberships = await supabase(`/rest/v1/app_memberships?select=organization_id&user_id=eq.${encodeURIComponent(userId)}&is_active=eq.true&limit=1`, { token });
  if (!memberships?.length) throw Object.assign(new Error('Your account has no app access yet. Ask the platform admin to assign access.'), { status:403 });
  const orgId = memberships[0].organization_id;
  const moduleRows = await getRows('app_registry', orgId, token, '&order=app_id');
  const appRows = Object.fromEntries(await Promise.all(appIds.map(async appId => {
    const moduleStatus = moduleRows.find(row => row.app_id === appId)?.status;
    return [appId, moduleStatus === 'removed' ? [] : await getRows(appId, orgId, token, '&order=created_at.asc', appId)];
  })));
  const [auditRows, contractRows] = await Promise.all([
    supabase(`/rest/v1/audit_log?select=*&organization_id=eq.${encodeURIComponent(orgId)}&order=created_at.desc&limit=100`, { token }),
    supabase('/rest/v1/integration_contracts?select=*&status=eq.active&order=producer_app,consumer_app', { token })
  ]);
  const modules = Object.fromEntries(definitions.map(def => {
    const row = moduleRows.find(item => item.app_id === def.id);
    return [def.id, { status:row?.status || 'active', updatedAt:row?.updated_at || '', deploymentMode:'supabase', workerName:'', repositoryPath:'', deploymentUrl:`/apps/${def.id}`, deploymentStatus:'local' }];
  }));
  return {
    organizationId:orgId,
    modules,
    contacts:appRows.contacts.map(toCamel),
    products:appRows.products.map(toCamel),
    orders:appRows.orders.map(toCamel),
    tasks:appRows.tasks.map(toCamel),
    integrationContracts:contractRows,
    audit:auditRows.map(row => ({ id:String(row.id), action:row.action, moduleId:row.app_id, details:JSON.stringify(row.details), at:row.created_at }))
  };
}

async function handleApi(req, res) {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/api/health') return json(res, 200, { ok: true, service: 'four-app-supabase-local' });
  if (req.method !== 'GET') assertSameOrigin(req);
  if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
    return json(res,200,{ ok:true },clearAuthCookies(req));
  }
  if (req.method === 'POST' && ['/api/auth/login','/api/auth/signup'].includes(url.pathname)) {
    const input = await readBody(req);
    if (!input.email || !input.password) return json(res,400,{ error:'Email and password are required.' });
    const signup = url.pathname.endsWith('signup');
    const result = await supabase(signup ? '/auth/v1/signup' : '/auth/v1/token?grant_type=password', {
      method:'POST', body:{ email:String(input.email).trim(), password:String(input.password) }
    });
    if (signup) {
      if (!result?.access_token) return json(res,200,{ needsConfirmation:true, message:'Account created. Confirm the email in local Supabase Mailpit, then sign in.' });
      return json(res,200,{ user:result.user, message:'Account created. Complete the one-time admin setup, then sign in.' });
    }
    if (!result?.access_token || !result?.refresh_token) throw Object.assign(new Error('Sign-in did not return a valid session.'), { status:401 });
    return json(res,200,{ user:result.user },cookieHeaders(req,result));
  }

  const { token, user } = await sessionFor(req,res);
  if (req.method === 'GET' && url.pathname === '/api/state') {
    return json(res,200,{ definitions, state:await stateFor(token,user.id) });
  }

  const lifecycle = url.pathname.match(/^\/api\/admin\/modules\/(contacts|products|orders|tasks)\/(activate|deactivate|retire|delete|remove)$/);
  if (req.method === 'POST' && lifecycle) {
    const [, appId, action] = lifecycle;
    const actionValue = action === 'remove' ? 'remove_schema' : action === 'delete' ? 'delete_data' : action;
    const state = await stateFor(token,user.id);
    const result = await supabase('/rest/v1/rpc/manage_app_lifecycle', {
      token, method:'POST', body:{ target_org:state.organizationId, target_app:appId, requested_action:actionValue }
    });
    return json(res,200,{ ok:true, status:result });
  }

  const match = url.pathname.match(/^\/api\/(contacts|products|orders|tasks)$/);
  if (match && req.method === 'POST') {
    const appId = match[1];
    const state = await stateFor(token,user.id);
    const current = state.modules[appId]?.status;
    if (current !== 'active') return json(res,409,{ error:`${appId} is ${current}. Activate it before creating records.` });
    const created = apps[appId].create(await readBody(req), state);
    const columns = {
      contacts:{ name:created.name, organization:created.organization, email:created.email, phone:created.phone, city:created.city, product_id:created.productId, product_name:created.productName, order_id:created.orderId, order_ref:created.orderRef, task_id:created.taskId, task_name:created.taskName },
      products:{ name:created.name, sku:created.sku, category:created.category, unit:created.unit, price:created.price, contact_id:created.contactId, contact_name:created.contactName, order_id:created.orderId, order_ref:created.orderRef, task_id:created.taskId, task_name:created.taskName },
      orders:{ order_no:created.orderNo, customer_id:created.customerId, customer_name:created.customerName, product_id:created.productId, product_name:created.productName, unit_price:created.unitPrice, quantity:created.quantity, status:created.status, task_id:created.taskId, task_name:created.taskName },
      tasks:{ name:created.name, assigned_to:created.assignedTo, order_id:created.orderId, order_ref:created.orderRef, contact_id:created.contactId, contact_name:created.contactName, product_id:created.productId, product_name:created.productName, due_date:created.dueDate || null, status:created.status }
    }[appId];
    const rows = await supabase(`/rest/v1/${appId}?select=*`, { token, method:'POST', body:{ organization_id:state.organizationId, ...columns }, prefer:'return=representation', schema:appId });
    return json(res,201,toCamel(rows[0]));
  }

  return json(res,404,{ error:'Route not found.' });
}

export async function route(req,res) {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/health') return json(res,200,{ ok:true, service:'four-app-supabase-local' });
  if (url.pathname.startsWith('/api/')) {
    try { return await handleApi(req,res); }
    catch (error) { return json(res,error.status || 500,{ error:error.message || 'Server error.' }); }
  }
  if (req.method !== 'GET') return json(res,405,{ error:'Method not allowed.' });
  const appPage = url.pathname.match(/^\/apps\/(contacts|products|orders|tasks)\/?$/);
  const requested = url.pathname === '/' ? 'index.html'
    : url.pathname === '/admin' || url.pathname === '/admin/' ? 'admin/index.html'
    : appPage ? `apps/${appPage[1]}/index.html` : url.pathname.slice(1);
  const file = path.resolve(publicDir,requested);
  if (!file.startsWith(path.resolve(publicDir)+path.sep) && file !== path.join(publicDir,'index.html')) return json(res,403,{error:'Forbidden'});
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return json(res,404,{error:'Not found.'});
  res.writeHead(200,{ 'content-type':mime[path.extname(file)] || 'application/octet-stream', 'cache-control':'no-store' });
  return fs.createReadStream(file).pipe(res);
}

if (!apiKey) console.warn('SUPABASE_PUBLISHABLE_KEY is missing. Copy the local key from `supabase start` into .env.local.');
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = http.createServer((req,res)=>route(req,res).catch(error=>json(res,error.status||500,{error:error.message||'Server error.'})));
  const port = Number(process.env.PORT || 3000);
  server.listen(port,'127.0.0.1',()=>console.log(`Four-app Supabase pilot: http://127.0.0.1:${port}`));
}
