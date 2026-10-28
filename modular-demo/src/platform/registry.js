const definitions = [
  { id: 'contacts', name: 'Contacts', description: 'People and organizations', collection: 'contacts', repositoryPath: 'modular-demo/src/apps/contacts' },
  { id: 'products', name: 'Products', description: 'Simple product catalogue', collection: 'products', repositoryPath: 'modular-demo/src/apps/products' },
  { id: 'orders', name: 'Orders', description: 'Customer orders with saved item snapshots', collection: 'orders', repositoryPath: 'modular-demo/src/apps/orders' },
  { id: 'tasks', name: 'Tasks', description: 'Follow-ups linked by optional order reference', collection: 'tasks', repositoryPath: 'modular-demo/src/apps/tasks' }
];
const initialState = () => ({
  modules: Object.fromEntries(definitions.map(m => [m.id, {
    status: 'active', updatedAt: new Date().toISOString(),
    deploymentMode: 'shared-worker', workerName: 'archscaleguild01', repositoryPath: m.repositoryPath
  }])),
  contacts: [], products: [], orders: [], tasks: [], audit: []
});

module.exports = { definitions, initialState };

