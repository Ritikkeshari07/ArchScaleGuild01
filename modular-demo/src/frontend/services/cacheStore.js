/**
 * Reusable Frontend Cache Store
 * Handles cross-tab synchronized localStorage caching for instantaneous 0ms page loads.
 */
const CACHE_KEY = 'archscale_cached_model';

export function getCachedModel() {
  try {
    const raw = localStorage.getItem(CACHE_KEY) || sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.modules ? parsed : null;
  } catch {
    return null;
  }
}

export function setCachedModel(model) {
  try {
    const serialized = JSON.stringify(model);
    localStorage.setItem(CACHE_KEY, serialized);
    sessionStorage.setItem(CACHE_KEY, serialized);
  } catch {}
}

export function clearCachedModel() {
  try {
    localStorage.removeItem(CACHE_KEY);
    sessionStorage.removeItem(CACHE_KEY);
  } catch {}
}
