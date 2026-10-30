/**
 * Reusable RelationshipCell Component
 * Renders cross-app references with snapshot resilience.
 * If the source record still exists, renders the name normally.
 * If the source record was deleted, renders the frozen snapshot with a badge.
 */
function esc(x = '') {
  return String(x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function relationshipCell(state, appId, id, snapshot) {
  const value = String(snapshot || '').trim();
  if (!value) return '';
  const label = esc(value);
  const stillExists = Boolean(id) && (state[appId] || []).some(record => record.id === id);
  return !id || stillExists
    ? label
    : `${label}<small class="snapshot-note" aria-label="Saved snapshot; source record deleted">Saved snapshot · source record deleted</small>`;
}
