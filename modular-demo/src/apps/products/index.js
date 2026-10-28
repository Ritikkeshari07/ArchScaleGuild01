module.exports = {
  id: 'products',
  create(input, state) {
    const { cleanText, number } = require('../../platform/validation');
    const record = {
      id: crypto.randomUUID(), name: cleanText(input.name, 'Product name'),
      sku: cleanText(input.sku, 'SKU', 60), category: String(input.category || '').trim(),
      unit: cleanText(input.unit || 'each', 'Unit', 40), price: number(input.price, 'Price'),
      createdAt: new Date().toISOString()
    };
    state.products.push(record); return record;
  }
};
