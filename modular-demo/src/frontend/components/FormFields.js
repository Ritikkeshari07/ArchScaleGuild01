/**
 * Reusable FormFields Component
 * Helper functions to construct sanitized form inputs and cross-app select fields.
 */
function esc(x = '') {
  return String(x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function field(label, name, type = 'text', required = false, extra = '') {
  return `<label>${esc(label)}<input name="${esc(name)}" type="${type}" ${required ? 'required' : ''} ${extra}></label>`;
}

export function options(rows = [], labelKey = 'name') {
  return '<option value="">Manual entry / none</option>' + rows.map(x => (
    `<option value="${esc(x.id)}">${esc(x[labelKey])}</option>`
  )).join('');
}
