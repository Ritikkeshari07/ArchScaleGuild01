module.exports = {
  id: 'tasks',
  create(input, state) {
    const { cleanText } = require('../../platform/validation');
    const order = state.orders.find(x => x.id === input.orderId);
    const record = {
      id: crypto.randomUUID(), name: cleanText(input.name, 'Task name'),
      assignedTo: cleanText(input.assignedTo, 'Assignee'),
      orderId: order?.id || null, orderRef: order?.orderNo || String(input.orderRef || '').trim(),
      dueDate: String(input.dueDate || '').trim(), status: input.status || 'Open',
      createdAt: new Date().toISOString()
    };
    state.tasks.push(record); return record;
  }
};
