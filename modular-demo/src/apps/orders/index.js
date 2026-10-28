module.exports = {
  id: 'orders',
  create(input, state) {
    const { cleanText, number } = require('../../platform/validation');
    const customer = state.contacts.find(x => x.id === input.customerId);
    const product = state.products.find(x => x.id === input.productId);
    const customerName = customer?.name || cleanText(input.customerName, 'Customer name');
    const productName = product?.name || cleanText(input.productName, 'Product name');
    const unitPrice = number(product ? product.price : input.unitPrice, 'Unit price');
    const quantity = number(input.quantity, 'Quantity', 1);
    const record = {
      id: crypto.randomUUID(), orderNo: cleanText(input.orderNo, 'Order number', 60),
      customerId: customer?.id || null, customerName,
      productId: product?.id || null, productName, unitPrice, quantity,
      total: Math.round(unitPrice * quantity * 100) / 100,
      status: input.status || 'Draft', createdAt: new Date().toISOString()
    };
    state.orders.push(record); return record;
  }
};
