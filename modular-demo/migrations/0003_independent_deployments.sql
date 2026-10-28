-- Track app deployment separately from app data/lifecycle.
-- Removing a Worker or repository must not delete these records or shared D1.
ALTER TABLE app_registry ADD COLUMN deployment_url TEXT NOT NULL DEFAULT '';
ALTER TABLE app_registry ADD COLUMN deployment_status TEXT NOT NULL DEFAULT 'planned';

UPDATE app_registry SET
  deployment_mode = 'independent-worker',
  worker_name = 'archscale-contacts',
  repository_path = 'modular-demo/deployables/contacts',
  deployment_url = 'https://archscale-contacts.keshariritik101.workers.dev',
  deployment_status = 'planned'
WHERE app_id = 'contacts';
UPDATE app_registry SET
  deployment_mode = 'independent-worker',
  worker_name = 'archscale-products',
  repository_path = 'modular-demo/deployables/products',
  deployment_url = 'https://archscale-products.keshariritik101.workers.dev',
  deployment_status = 'planned'
WHERE app_id = 'products';
UPDATE app_registry SET
  deployment_mode = 'independent-worker',
  worker_name = 'archscale-orders',
  repository_path = 'modular-demo/deployables/orders',
  deployment_url = 'https://archscale-orders.keshariritik101.workers.dev',
  deployment_status = 'planned'
WHERE app_id = 'orders';
UPDATE app_registry SET
  deployment_mode = 'independent-worker',
  worker_name = 'archscale-tasks',
  repository_path = 'modular-demo/deployables/tasks',
  deployment_url = 'https://archscale-tasks.keshariritik101.workers.dev',
  deployment_status = 'planned'
WHERE app_id = 'tasks';
