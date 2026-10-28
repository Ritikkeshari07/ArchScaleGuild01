module.exports = {
  id: 'products',
  create(input, state) {
    const { cleanText, number } = require('../../platform/validation');
    const contact = state.contacts.find(x => x.id === input.contactId);
    const order = state.orders.find(x => x.id === input.orderId);
    const task = state.tasks.find(x => x.id === input.taskId);
    const record = {
      id: crypto.randomUUID(), name: cleanText(input.name, 'Product name'),
      sku: cleanText(input.sku, 'SKU', 60), category: String(input.category || '').trim(),
      unit: cleanText(input.unit || 'each', 'Unit', 40), price: number(input.price, 'Price'),
      contactId: contact?.id || null, contactName: contact?.name || String(input.contactName || '').trim(),
      orderId: order?.id || null, orderRef: order?.orderNo || String(input.orderRef || '').trim(),
      taskId: task?.id || null, taskName: task?.name || String(input.taskName || '').trim(),
      createdAt: new Date().toISOString()
    };
    state.products.push(record); return record;
  }
};
