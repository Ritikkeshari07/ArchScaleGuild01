-- Move the hosted demo from one shared JSON payload into app-owned tables.
-- Cross-app IDs and display snapshots are intentionally not foreign keys: removing
-- one app's deployment or records must not cascade into another app's data.

CREATE TABLE IF NOT EXISTS platform_meta (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  revision INTEGER NOT NULL DEFAULT 0,
  last_write_id TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS app_registry (
  app_id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'retired', 'deleted')),
  updated_at TEXT NOT NULL,
  deployment_mode TEXT NOT NULL DEFAULT 'shared-worker',
  worker_name TEXT NOT NULL DEFAULT 'archscaleguild01',
  repository_path TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  organization TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  product_id TEXT,
  product_name TEXT NOT NULL DEFAULT '',
  order_id TEXT,
  order_ref TEXT NOT NULL DEFAULT '',
  task_id TEXT,
  task_name TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  unit TEXT NOT NULL DEFAULT 'each',
  price REAL NOT NULL DEFAULT 0,
  contact_id TEXT,
  contact_name TEXT NOT NULL DEFAULT '',
  order_id TEXT,
  order_ref TEXT NOT NULL DEFAULT '',
  task_id TEXT,
  task_name TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_no TEXT NOT NULL UNIQUE,
  customer_id TEXT,
  customer_name TEXT NOT NULL,
  product_id TEXT,
  product_name TEXT NOT NULL,
  unit_price REAL NOT NULL,
  quantity REAL NOT NULL,
  total REAL NOT NULL,
  task_id TEXT,
  task_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Draft',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  assigned_to TEXT NOT NULL,
  order_id TEXT,
  order_ref TEXT NOT NULL DEFAULT '',
  contact_id TEXT,
  contact_name TEXT NOT NULL DEFAULT '',
  product_id TEXT,
  product_name TEXT NOT NULL DEFAULT '',
  due_date TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Open',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  position INTEGER PRIMARY KEY,
  id TEXT NOT NULL UNIQUE,
  action TEXT NOT NULL,
  module_id TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contacts_product_id ON contacts(product_id);
CREATE INDEX IF NOT EXISTS idx_contacts_order_id ON contacts(order_id);
CREATE INDEX IF NOT EXISTS idx_contacts_task_id ON contacts(task_id);
CREATE INDEX IF NOT EXISTS idx_products_contact_id ON products(contact_id);
CREATE INDEX IF NOT EXISTS idx_products_order_id ON products(order_id);
CREATE INDEX IF NOT EXISTS idx_products_task_id ON products(task_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_product_id ON orders(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_task_id ON orders(task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_order_id ON tasks(order_id);
CREATE INDEX IF NOT EXISTS idx_tasks_contact_id ON tasks(contact_id);
CREATE INDEX IF NOT EXISTS idx_tasks_product_id ON tasks(product_id);

INSERT OR IGNORE INTO platform_meta (id, revision, last_write_id)
SELECT 1, revision, '' FROM demo_state WHERE id = 1;
INSERT OR IGNORE INTO platform_meta (id, revision, last_write_id) VALUES (1, 0, '');

INSERT OR IGNORE INTO app_registry (app_id, status, updated_at, deployment_mode, worker_name, repository_path)
SELECT app.key,
       COALESCE(json_extract(app.value, '$.status'), 'active'),
       COALESCE(json_extract(app.value, '$.updatedAt'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
       'shared-worker', 'archscaleguild01',
       'modular-demo/src/apps/' || app.key
FROM demo_state AS state, json_each(state.payload, '$.modules') AS app
WHERE state.id = 1;

INSERT OR IGNORE INTO app_registry (app_id, status, updated_at, deployment_mode, worker_name, repository_path)
VALUES
  ('contacts', 'active', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), 'shared-worker', 'archscaleguild01', 'modular-demo/src/apps/contacts'),
  ('products', 'active', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), 'shared-worker', 'archscaleguild01', 'modular-demo/src/apps/products'),
  ('orders', 'active', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), 'shared-worker', 'archscaleguild01', 'modular-demo/src/apps/orders'),
  ('tasks', 'active', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), 'shared-worker', 'archscaleguild01', 'modular-demo/src/apps/tasks');

INSERT OR IGNORE INTO contacts (id, name, organization, email, phone, city, product_id, product_name, order_id, order_ref, task_id, task_name, created_at)
SELECT json_extract(item.value, '$.id'), json_extract(item.value, '$.name'),
       COALESCE(json_extract(item.value, '$.organization'), ''), COALESCE(json_extract(item.value, '$.email'), ''),
       COALESCE(json_extract(item.value, '$.phone'), ''), COALESCE(json_extract(item.value, '$.city'), ''),
       json_extract(item.value, '$.productId'), COALESCE(json_extract(item.value, '$.productName'), ''),
       json_extract(item.value, '$.orderId'), COALESCE(json_extract(item.value, '$.orderRef'), ''),
       json_extract(item.value, '$.taskId'), COALESCE(json_extract(item.value, '$.taskName'), ''),
       COALESCE(json_extract(item.value, '$.createdAt'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
FROM demo_state AS state, json_each(state.payload, '$.contacts') AS item WHERE state.id = 1;

INSERT OR IGNORE INTO products (id, name, sku, category, unit, price, contact_id, contact_name, order_id, order_ref, task_id, task_name, created_at)
SELECT json_extract(item.value, '$.id'), json_extract(item.value, '$.name'), json_extract(item.value, '$.sku'),
       COALESCE(json_extract(item.value, '$.category'), ''), COALESCE(json_extract(item.value, '$.unit'), 'each'),
       COALESCE(json_extract(item.value, '$.price'), 0), json_extract(item.value, '$.contactId'),
       COALESCE(json_extract(item.value, '$.contactName'), ''), json_extract(item.value, '$.orderId'),
       COALESCE(json_extract(item.value, '$.orderRef'), ''), json_extract(item.value, '$.taskId'),
       COALESCE(json_extract(item.value, '$.taskName'), ''),
       COALESCE(json_extract(item.value, '$.createdAt'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
FROM demo_state AS state, json_each(state.payload, '$.products') AS item WHERE state.id = 1;

INSERT OR IGNORE INTO orders (id, order_no, customer_id, customer_name, product_id, product_name, unit_price, quantity, total, task_id, task_name, status, created_at)
SELECT json_extract(item.value, '$.id'), json_extract(item.value, '$.orderNo'), json_extract(item.value, '$.customerId'),
       json_extract(item.value, '$.customerName'), json_extract(item.value, '$.productId'), json_extract(item.value, '$.productName'),
       COALESCE(json_extract(item.value, '$.unitPrice'), 0), COALESCE(json_extract(item.value, '$.quantity'), 0),
       COALESCE(json_extract(item.value, '$.total'), 0), json_extract(item.value, '$.taskId'),
       COALESCE(json_extract(item.value, '$.taskName'), ''), COALESCE(json_extract(item.value, '$.status'), 'Draft'),
       COALESCE(json_extract(item.value, '$.createdAt'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
FROM demo_state AS state, json_each(state.payload, '$.orders') AS item WHERE state.id = 1;

INSERT OR IGNORE INTO tasks (id, name, assigned_to, order_id, order_ref, contact_id, contact_name, product_id, product_name, due_date, status, created_at)
SELECT json_extract(item.value, '$.id'), json_extract(item.value, '$.name'), json_extract(item.value, '$.assignedTo'),
       json_extract(item.value, '$.orderId'), COALESCE(json_extract(item.value, '$.orderRef'), ''),
       json_extract(item.value, '$.contactId'), COALESCE(json_extract(item.value, '$.contactName'), ''),
       json_extract(item.value, '$.productId'), COALESCE(json_extract(item.value, '$.productName'), ''),
       COALESCE(json_extract(item.value, '$.dueDate'), ''), COALESCE(json_extract(item.value, '$.status'), 'Open'),
       COALESCE(json_extract(item.value, '$.createdAt'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
FROM demo_state AS state, json_each(state.payload, '$.tasks') AS item WHERE state.id = 1;

INSERT OR IGNORE INTO audit_log (position, id, action, module_id, details, created_at)
SELECT CAST(item.key AS INTEGER), json_extract(item.value, '$.id'), json_extract(item.value, '$.action'),
       COALESCE(json_extract(item.value, '$.moduleId'), 'platform'), COALESCE(json_extract(item.value, '$.details'), ''),
       COALESCE(json_extract(item.value, '$.at'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
FROM demo_state AS state, json_each(state.payload, '$.audit') AS item WHERE state.id = 1;

