import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const definitions = {
  contacts: { name: 'Contacts', worker: 'archscale-contacts' },
  products: { name: 'Products', worker: 'archscale-products' },
  orders: { name: 'Orders', worker: 'archscale-orders' },
  tasks: { name: 'Tasks', worker: 'archscale-tasks' }
};

const workerSource = `export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ ok: true, service: env.APP_ID }), {
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
      });
    }
    if (url.pathname !== '/health' && !request.headers.has('authorization')) {
      const challenge = await env.PLATFORM.fetch(new Request('https://platform.internal/api/state'));
      if (challenge.status === 401) return challenge;
    }
    if (url.pathname.startsWith('/api/')) {
      const target = new URL(url.pathname + url.search, 'https://platform.internal');
      return env.PLATFORM.fetch(new Request(target, request));
    }
    return env.ASSETS.fetch(request);
  }
};
`;

export async function buildApp(appId, projectRoot = root) {
  const app = definitions[appId];
  if (!app) throw new Error(`Unknown app: ${appId}`);
  const dir = path.join(projectRoot, 'deployables', appId);
  const publicDir = path.join(dir, 'public');
  const sourceDir = path.join(dir, 'src');
  await Promise.all([mkdir(publicDir, { recursive: true }), mkdir(sourceDir, { recursive: true })]);
  await Promise.all([
    copyFile(path.join(projectRoot, 'public', 'app.js'), path.join(publicDir, 'app.js')),
    copyFile(path.join(projectRoot, 'public', 'styles.css'), path.join(publicDir, 'styles.css')),
    writeFile(path.join(sourceDir, 'index.mjs'), workerSource)
  ]);
  const dashboardUrl = 'https://archscaleguild01.keshariritik101.workers.dev/';
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${app.name} App Workspace</title><link rel="stylesheet" href="/styles.css"></head>
<body><header class="top"><div><a class="toplink" href="${dashboardUrl}">← Back to dashboard</a><span class="eyebrow">ARCHSCALE · INDEPENDENT APP WORKSPACE</span><h1 id="app-title">${app.name}</h1><p>Dedicated app deployment · linked records use the shared platform</p></div></header><main><div id="status-message"></div><section id="workspace" class="workspace"></section></main><script>window.ARCHSCALE_APP_ID=${JSON.stringify(appId)};</script><script src="/app.js" defer></script></body></html>
`;
  await writeFile(path.join(publicDir, 'index.html'), html);
  const config = {
    "$schema": "../../node_modules/wrangler/config-schema.json",
    name: app.worker,
    main: "src/index.mjs",
    compatibility_date: "2026-10-28",
    workers_dev: true,
    assets: { directory: "./public", binding: "ASSETS", run_worker_first: true },
    services: [{ binding: "PLATFORM", service: "archscaleguild01" }],
    vars: { APP_ID: appId }
  };
  await writeFile(path.join(dir, 'wrangler.jsonc'), `${JSON.stringify(config, null, 2)}\n`);
  return { appId, worker: app.worker, rootDirectory: `deployables/${appId}` };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const appId = process.argv[2];
  if (!appId) throw new Error('Usage: node scripts/build-app.mjs <contacts|products|orders|tasks>');
  const result = await buildApp(appId);
  process.stdout.write(`Prepared ${result.worker} in ${result.rootDirectory}.\n`);
}
