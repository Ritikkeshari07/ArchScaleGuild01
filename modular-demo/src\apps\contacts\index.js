module.exports = {
  id: 'contacts',
  create(input, state) {
    const { cleanText } = require('../../platform/validation');
    const record = {
      id: crypto.randomUUID(), name: cleanText(input.name, 'Name'),
      organization: String(input.organization || '').trim(), email: String(input.email || '').trim(),
      phone: String(input.phone || '').trim(), city: String(input.city || '').trim(),
      createdAt: new Date().toISOString()
    };
    state.contacts.push(record); return record;
  }
};
