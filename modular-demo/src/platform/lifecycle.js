const { definitions } = require('./registry');
function transition(state, id, action) {
  const definition = definitions.find(x => x.id === id);
  if (!definition) throw new Error('Unknown app.');
  if (!['activate','deactivate','retire','delete'].includes(action)) throw new Error('Unsupported lifecycle action.');
  const current = state.modules[id] || {};
  if (action === 'activate') state.modules[id] = { ...current, status:'active', updatedAt:new Date().toISOString() };
  if (action === 'deactivate') state.modules[id] = { ...current, status:'inactive', updatedAt:new Date().toISOString() };
  if (action === 'retire') state.modules[id] = { ...current, status:'retired', updatedAt:new Date().toISOString() };
  if (action === 'delete') {
    state[definition.collection] = [];
    state.modules[id] = { ...current, status:'deleted', updatedAt:new Date().toISOString() };
  }
  return state.modules[id];
}
function assertActive(state,id) {
  const definition = definitions.find(x => x.id === id);
  if (!definition) throw new Error('Unknown app.');
  const status = state.modules[id]?.status;
  if (status !== 'active') throw new Error(`${definition.name} is ${status || 'unavailable'}. Activate it to use its app.`);
}
module.exports = { transition, assertActive };


