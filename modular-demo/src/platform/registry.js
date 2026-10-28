const definitions = [
  { id: 'contacts', name: 'Contacts', description: 'People and organizations', collection: 'contacts' },
  { id: 'products', name: 'Products', description: 'Simple product catalogue', collection: 'products' },
  { id: 'orders', name: 'Orders', description: 'Customer orders with saved item snapshots', collection: 'orders' },
  { id: 'tasks', name: 'Tasks', description: 'Follow-ups linked by optional order reference', collection: 'tasks' }
];
const initialState = () => ({
  modules: Object.fromEntries(definitions.map(m => [m.id, { status: 'active', updatedAt: new Date().toISOString() }])),
  contacts: [], products: [], orders: [], tasks: [], audit: []
});

module.exports = { definitions, initialState };

