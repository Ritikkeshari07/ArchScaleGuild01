module.exports = {
  id: 'tasks',
  create(input, state) {
    const { cleanText } = require('../../platform/validation');
    const order = state.orders.find(x => x.id === input.orderId);
    const contact = state.contacts.find(x => x.id === input.contactId);
    const product = state.products.find(x => x.id === input.productId);
    const record = {
      id: crypto.randomUUID(), name: cleanText(input.name, 'Task name'),
      assignedTo: cleanText(input.assignedTo, 'Assignee'),
      orderId: order?.id || null, orderRef: order?.orderNo || String(input.orderRef || '').trim(),
      contactId: contact?.id || null, contactName: contact?.name || String(input.contactName || '').trim(),
      productId: product?.id || null, productName: product?.name || String(input.productName || '').trim(),
      dueDate: String(input.dueDate || '').trim(), status: input.status || 'Open',
      createdAt: new Date().toISOString()
    };
    state.tasks.push(record); return record;
  }
};
