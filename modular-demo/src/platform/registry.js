const definitions = [
  { id: 'contacts', name: 'Contacts', description: 'People and organizations', collection: 'contacts', workerName: 'archscale-contacts', repositoryPath: 'modular-demo/deployables/contacts', deploymentUrl: 'https://archscale-contacts.keshariritik101.workers.dev' },
  { id: 'products', name: 'Products', description: 'Simple product catalogue', collection: 'products', workerName: 'archscale-products', repositoryPath: 'modular-demo/deployables/products', deploymentUrl: 'https://archscale-products.keshariritik101.workers.dev' },
  { id: 'orders', name: 'Orders', description: 'Customer orders with saved item snapshots', collection: 'orders', workerName: 'archscale-orders', repositoryPath: 'modular-demo/deployables/orders', deploymentUrl: 'https://archscale-orders.keshariritik101.workers.dev' },
  { id: 'tasks', name: 'Tasks', description: 'Follow-ups linked by optional order reference', collection: 'tasks', workerName: 'archscale-tasks', repositoryPath: 'modular-demo/deployables/tasks', deploymentUrl: 'https://archscale-tasks.keshariritik101.workers.dev' }
];
const initialState = () => ({
  modules: Object.fromEntries(definitions.map(m => [m.id, {
    status: 'active', updatedAt: new Date().toISOString(),
    deploymentMode: 'independent-worker', workerName: m.workerName,
    repositoryPath: m.repositoryPath, deploymentUrl: m.deploymentUrl, deploymentStatus: 'planned'
  }])),
  contacts: [], products: [], orders: [], tasks: [], audit: []
});

module.exports = { definitions, initialState };
