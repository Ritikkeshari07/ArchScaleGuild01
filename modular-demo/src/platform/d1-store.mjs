import registry from './registry.js';

const { definitions, initialState } = registry;
const text = value => value == null ? '' : String(value);
const nullable = value => value == null || value === '' ? null : value;

async function rows(db, sql) {
  const result = await db.prepare(sql).all();
  return result.results || [];
}

function attachRevision(state, revision) {
  Object.defineProperty(state, '__revision', { value: Number(revision), writable: true, enumerable: false });
  return state;
}

export async function readState(db) {
  const [meta, modules, contacts, products, orders, tasks, audit] = await Promise.all([
    db.prepare('SELECT revision FROM platform_meta WHERE id = 1').first(),
    rows(db, 'SELECT app_id, status, updated_at, deployment_mode, worker_name, repository_path, deployment_url, deployment_status FROM app_registry'),
    rows(db, 'SELECT * FROM contacts ORDER BY created_at, id'),
    rows(db, 'SELECT * FROM products ORDER BY created_at, id'),
    rows(db, 'SELECT * FROM orders ORDER BY created_at, id'),
    rows(db, 'SELECT * FROM tasks ORDER BY created_at, id'),
    rows(db, 'SELECT id, action, module_id, details, created_at FROM audit_log ORDER BY position')
  ]);
  if (!meta) throw new Error('D1 app tables are missing. Apply migration 0002_app_owned_tables.sql first.');

  const state = initialState();
  for (const row of modules) {
    state.modules[row.app_id] = {
      status: row.status,
      updatedAt: row.updated_at,
      deploymentMode: row.deployment_mode,
      workerName: row.worker_name,
      repositoryPath: row.repository_path,
      deploymentUrl: row.deployment_url,
      deploymentStatus: row.deployment_status
    };
  }
  state.contacts = contacts.map(row => ({
    id: row.id, name: row.name, organization: row.organization, email: row.email, phone: row.phone, city: row.city,
    productId: row.product_id, productName: row.product_name, orderId: row.order_id, orderRef: row.order_ref,
    taskId: row.task_id, taskName: row.task_name, createdAt: row.created_at
  }));
  state.products = products.map(row => ({
    id: row.id, name: row.name, sku: row.sku, category: row.category, unit: row.unit, price: Number(row.price),
    contactId: row.contact_id, contactName: row.contact_name, orderId: row.order_id, orderRef: row.order_ref,
    taskId: row.task_id, taskName: row.task_name, createdAt: row.created_at
  }));
  state.orders = orders.map(row => ({
    id: row.id, orderNo: row.order_no, customerId: row.customer_id, customerName: row.customer_name,
    productId: row.product_id, productName: row.product_name, unitPrice: Number(row.unit_price),
    quantity: Number(row.quantity), total: Number(row.total), taskId: row.task_id, taskName: row.task_name,
    status: row.status, createdAt: row.created_at
  }));
  state.tasks = tasks.map(row => ({
    id: row.id, name: row.name, assignedTo: row.assigned_to, orderId: row.order_id, orderRef: row.order_ref,
    contactId: row.contact_id, contactName: row.contact_name, productId: row.product_id,
    productName: row.product_name, dueDate: row.due_date, status: row.status, createdAt: row.created_at
  }));
  state.audit = audit.map(row => ({ id: row.id, action: row.action, moduleId: row.module_id, details: row.details, at: row.created_at }));
  return attachRevision(state, meta.revision);
}

function replaceTable(db, table, columns, dataRows, writeId) {
  const statements = [db.prepare(`DELETE FROM ${table} WHERE EXISTS (SELECT 1 FROM platform_meta WHERE id = 1 AND last_write_id = ?)`)
    .bind(writeId)];
  if (!dataRows.length) return statements;
  const values = columns.map(() => '?').join(', ');
  const sql = `INSERT INTO ${table} (${columns.join(', ')}) SELECT ${values} WHERE EXISTS (SELECT 1 FROM platform_meta WHERE id = 1 AND last_write_id = ?)`;
  for (const row of dataRows) statements.push(db.prepare(sql).bind(...row, writeId));
  return statements;
}

export async function writeState(db, state) {
  const revision = Number(state.__revision || 0);
  const writeId = crypto.randomUUID();
  const statements = [db.prepare('UPDATE platform_meta SET revision = revision + 1, last_write_id = ? WHERE id = 1 AND revision = ?')
    .bind(writeId, revision)];
  const moduleRows = definitions.map(definition => {
    const module = state.modules[definition.id] || {};
    return [definition.id, module.status || 'active', module.updatedAt || new Date().toISOString(),
      module.deploymentMode || 'independent-worker', module.workerName || definition.workerName,
      module.repositoryPath || definition.repositoryPath,
      module.deploymentUrl || definition.deploymentUrl,
      module.deploymentStatus || 'planned'];
  });
  statements.push(...replaceTable(db, 'app_registry', ['app_id', 'status', 'updated_at', 'deployment_mode', 'worker_name', 'repository_path', 'deployment_url', 'deployment_status'], moduleRows, writeId));
  statements.push(...replaceTable(db, 'contacts',
    ['id', 'name', 'organization', 'email', 'phone', 'city', 'product_id', 'product_name', 'order_id', 'order_ref', 'task_id', 'task_name', 'created_at'],
    state.contacts.map(row => [row.id, row.name, text(row.organization), text(row.email), text(row.phone), text(row.city), nullable(row.productId), text(row.productName), nullable(row.orderId), text(row.orderRef), nullable(row.taskId), text(row.taskName), row.createdAt]), writeId));
  statements.push(...replaceTable(db, 'products',
    ['id', 'name', 'sku', 'category', 'unit', 'price', 'contact_id', 'contact_name', 'order_id', 'order_ref', 'task_id', 'task_name', 'created_at'],
    state.products.map(row => [row.id, row.name, row.sku, text(row.category), row.unit, Number(row.price), nullable(row.contactId), text(row.contactName), nullable(row.orderId), text(row.orderRef), nullable(row.taskId), text(row.taskName), row.createdAt]), writeId));
  statements.push(...replaceTable(db, 'orders',
    ['id', 'order_no', 'customer_id', 'customer_name', 'product_id', 'product_name', 'unit_price', 'quantity', 'total', 'task_id', 'task_name', 'status', 'created_at'],
    state.orders.map(row => [row.id, row.orderNo, nullable(row.customerId), row.customerName, nullable(row.productId), row.productName, Number(row.unitPrice), Number(row.quantity), Number(row.total), nullable(row.taskId), text(row.taskName), row.status, row.createdAt]), writeId));
  statements.push(...replaceTable(db, 'tasks',
    ['id', 'name', 'assigned_to', 'order_id', 'order_ref', 'contact_id', 'contact_name', 'product_id', 'product_name', 'due_date', 'status', 'created_at'],
    state.tasks.map(row => [row.id, row.name, row.assignedTo, nullable(row.orderId), text(row.orderRef), nullable(row.contactId), text(row.contactName), nullable(row.productId), text(row.productName), text(row.dueDate), row.status, row.createdAt]), writeId));
  statements.push(...replaceTable(db, 'audit_log', ['position', 'id', 'action', 'module_id', 'details', 'created_at'],
    state.audit.map((row, position) => [position, row.id, row.action, row.moduleId, text(row.details), row.at]), writeId));

  const results = await db.batch(statements);
  if (results[0]?.meta?.changes !== 1) {
    const error = new Error('Another app action was saved at the same time. Reload and try again.');
    error.status = 409;
    throw error;
  }
  state.__revision = revision + 1;
}
