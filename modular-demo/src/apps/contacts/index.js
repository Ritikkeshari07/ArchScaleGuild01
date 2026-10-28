module.exports = {
  id: 'contacts',
  create(input, state) {
    const { cleanText } = require('../../platform/validation');
    const product = state.products.find(x => x.id === input.productId);
    const order = state.orders.find(x => x.id === input.orderId);
    const task = state.tasks.find(x => x.id === input.taskId);
    const record = {
      id: crypto.randomUUID(), name: cleanText(input.name, 'Name'),
      organization: String(input.organization || '').trim(), email: String(input.email || '').trim(),
      phone: String(input.phone || '').trim(), city: String(input.city || '').trim(),
      productId: product?.id || null, productName: product?.name || String(input.productName || '').trim(),
      orderId: order?.id || null, orderRef: order?.orderNo || String(input.orderRef || '').trim(),
      taskId: task?.id || null, taskName: task?.name || String(input.taskName || '').trim(),
      createdAt: new Date().toISOString()
    };
    state.contacts.push(record); return record;
  }
};
