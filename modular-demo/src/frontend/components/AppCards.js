/**
 * Reusable AppCards Component
 * Renders the responsive grid of modular application workspaces with deployment
 * status pills and direct routing links.
 */
function esc(x = '') {
  return String(x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function renderAppCard(definition, moduleState = {}) {
  const status = moduleState.status || 'deleted';
  const url = moduleState.deploymentStatus === 'deployed' && moduleState.deploymentUrl
    ? moduleState.deploymentUrl
    : `/apps/${definition.id}`;

  return `
    <a class="app-card ${status}" href="${esc(url)}">
      <div>
        <span class="eyebrow">${esc(moduleState.deploymentMode || 'APP')}</span>
        <h3>${esc(definition.name)}</h3>
        <p>${esc(definition.description)}</p>
        <small>${esc(moduleState.workerName || '')} · deployment ${esc(moduleState.deploymentStatus || 'planned')}</small>
      </div>
      <span class="pill ${status}">${status}</span>
      <b class="open-app">Open ${esc(definition.name)} →</b>
    </a>
  `;
}

export function renderAppCardsGrid(definitions, modulesState) {
  return definitions
    .filter(d => modulesState[d.id]?.status !== 'removed')
    .map(d => renderAppCard(d, modulesState[d.id] || {}))
    .join('');
}
