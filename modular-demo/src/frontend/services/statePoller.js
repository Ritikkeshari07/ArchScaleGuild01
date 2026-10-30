/**
 * Reusable Frontend State Poller
 * Polls platform state periodically when the tab is visible and there are no unsaved form drafts.
 */
export function hasUnsavedFormDraft(formElement) {
  return Boolean(formElement && [...formElement.elements].some(field => field.name && field.value));
}

export function startStatePolling({ pollFn, intervalMs = 8000, isActiveFn = () => true }) {
  return window.setInterval(() => {
    if (document.hidden || !isActiveFn()) return;
    pollFn().catch(err => {
      if (err.status !== 401) console.error('Could not refresh shared app data.', err);
    });
  }, intervalMs);
}
