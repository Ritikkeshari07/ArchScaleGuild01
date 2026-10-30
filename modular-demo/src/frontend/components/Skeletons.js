/**
 * Reusable Skeletons Component
 * Provides responsive animated placeholders for workspaces, tables, and card grids.
 */
export function workspaceSkeleton(appName = 'Workspace') {
  return `
    <div class="apphead">
      <div>
        <span class="eyebrow">STANDALONE WORKSPACE · ${appName.toUpperCase()}</span>
        <h2>${appName}</h2>
      </div>
      <span class="pill">loading</span>
    </div>
    <p class="muted">Loading workspace data from the shared platform…</p>
    <div class="skeleton-bar h-40"></div>
    <div class="skeleton-bar h-28 w-80"></div>
    <div class="skeleton-bar h-28 w-60"></div>
  `;
}

export function appCardsSkeleton(names = ['Contacts', 'Products', 'Orders', 'Tasks']) {
  return names.map(name => `
    <div class="skeleton-card">
      <div>
        <span class="skeleton-bar w-20"></span>
        <h3 style="margin:8px 0">${name}</h3>
        <div class="skeleton-bar w-80"></div>
      </div>
      <span class="skeleton-bar w-40" style="margin:0"></span>
    </div>
  `).join('');
}

export function registrySkeleton(names = ['Contacts', 'Products', 'Orders', 'Tasks']) {
  return names.map(name => `
    <article class="module">
      <div>
        <b>${name}</b>
        <span class="pill">loading</span>
        <div class="skeleton-bar w-80"></div>
      </div>
    </article>
  `).join('');
}
