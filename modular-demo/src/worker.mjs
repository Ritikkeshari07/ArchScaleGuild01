import registry from './platform/registry.js';
import lifecycle from './platform/lifecycle.js';
import contacts from './apps/contacts/index.js';
import products from './apps/products/index.js';
import orders from './apps/orders/index.js';
import tasks from './apps/tasks/index.js';
import { readState, writeState } from './platform/d1-store.mjs';

const { definitions, initialState } = registry;
const { transition, assertActive } = lifecycle;
const apps = { contacts, products, orders, tasks };

function json(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extraHeaders }
  });
}

function basicAuthOk(request, password) {
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Basic ')) return false;
  try {
    const credentials = atob(header.slice(6));
    const separator = credentials.indexOf(':');
    return separator >= 0 && credentials.slice(separator + 1) === password;
  } catch {
    return false;
  }
}

function audit(state, action, moduleId, details = '') {
  state.audit.unshift({ id: crypto.randomUUID(), action, moduleId, details, at: new Date().toISOString() });
  state.audit = state.audit.slice(0, 100);
}

async function readJson(request) {
  const text = await request.text();
  if (text.length > 1_000_000) throw new Error('Request too large.');
  try { return text ? JSON.parse(text) : {}; }
  catch { throw new Error('Invalid JSON.'); }
}

async function handleApi(request, env) {
  const url = new URL(request.url);
  if (request.method === 'GET' && url.pathname === '/api/state') {
    return json(200, { definitions, state: await readState(env.DB) });
  }

  if (request.method === 'POST' && url.pathname === '/api/demo/reset') {
    const previous = await readState(env.DB);
    const state = initialState();
    Object.defineProperty(state, '__revision', { value: previous.__revision, writable: true, enumerable: false });
    const contact = apps.contacts.create({ name: 'ABC Studio', organization: 'ABC Studio', city: 'Mumbai', productName: 'Marble Sample', orderRef: 'ORD-001', taskName: 'Confirm delivery' }, state);
    const product = apps.products.create({ name: 'Marble Sample', sku: 'MAR-001', category: 'Samples', unit: 'each', price: 500, contactId: contact.id, orderRef: 'ORD-001', taskName: 'Confirm delivery' }, state);
    const order = apps.orders.create({ orderNo: 'ORD-001', customerId: contact.id, productId: product.id, quantity: 4, status: 'Confirmed' }, state);
    const task = apps.tasks.create({ name: 'Confirm delivery', assignedTo: 'Demo Admin', orderId: order.id, contactId: contact.id, productId: product.id, dueDate: '2026-10-30' }, state);
    contact.productId = product.id; contact.orderId = order.id; contact.taskId = task.id;
    product.orderId = order.id; product.taskId = task.id;
    order.taskId = task.id; order.taskName = task.name;
    audit(state, 'demo-reset', 'platform', 'Loaded ABC Studio example records');
    await writeState(env.DB, state);
    return json(200, { ok: true });
  }

  const admin = url.pathname.match(/^\/api\/admin\/modules\/([a-z]+)\/(activate|deactivate|retire|delete)$/);
  if (request.method === 'POST' && admin) {
    const [, id, action] = admin;
    if (!definitions.some(item => item.id === id)) return json(404, { error: 'Unknown app.' });
    const state = await readState(env.DB);
    transition(state, id, action);
    audit(state, action, id, action === 'delete' ? 'Module records removed from hosted demo database' : '');
    await writeState(env.DB, state);
    return json(200, { ok: true, status: state.modules[id].status });
  }

  const record = url.pathname.match(/^\/api\/([a-z]+)$/);
  if (record && ['GET', 'POST'].includes(request.method)) {
    const id = record[1], app = apps[id], definition = definitions.find(item => item.id === id);
    if (!app || !definition) return json(404, { error: 'Unknown app.' });
    const state = await readState(env.DB);
    try { assertActive(state, id); }
    catch (error) { return json(409, { error: error.message }); }
    if (request.method === 'GET') return json(200, state[definition.collection]);
    try {
      const created = app.create(await readJson(request), state);
      audit(state, 'record-created', id, created.id);
      await writeState(env.DB, state);
      return json(201, created);
    } catch (error) {
      if (error.status === 409) return json(409, { error: error.message });
      return json(400, { error: error.message });
    }
  }
  return json(404, { error: 'Route not found.' });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') return json(200, { ok: true, service: 'four-apps-demo' });
    if (url.pathname.startsWith('/api/')) {
      if (!env.DEMO_PASSWORD) return json(503, { error: 'Demo access is not configured yet.' });
      if (!basicAuthOk(request, env.DEMO_PASSWORD)) {
        return json(401, { error: 'A manager demo password is required.' });
      }
      try { return await handleApi(request, env); }
      catch (error) { return json(error.status || 500, { error: error.message || 'Server error.' }); }
    }
    return env.ASSETS.fetch(request);
  }
};
