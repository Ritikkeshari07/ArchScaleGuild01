import { mkdir, writeFile, copyFile, cp } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const reposRoot = path.resolve(projectRoot, '..', 'repos');

const appMeta = {
  contacts: {
    name: 'ArchScale Contacts',
    repo: 'archscale-contacts',
    domain: 'archscale-contacts.vercel.app',
    port: 3001,
    desc: 'Customer and partner directory workspace with soft-reference snapshot integration.',
    mockState: {
      contacts: [
        { id: 'c0000000-0000-4000-8000-000000000001', name: 'ABC Studio', organization: 'ABC Studio', city: 'Mumbai', email: 'contact@abc.test', phone: '+91 98765 43210', productId: 'b0000000-0000-4000-8000-000000000001', productName: 'Marble Sample', orderId: 'd0000000-0000-4000-8000-000000000001', orderRef: 'ORD-001', taskId: 'e0000000-0000-4000-8000-000000000001', taskName: 'Confirm delivery' }
      ],
      products: [{ id: 'b0000000-0000-4000-8000-000000000001', name: 'Marble Sample', price: 500 }],
      orders: [{ id: 'd0000000-0000-4000-8000-000000000001', orderNo: 'ORD-001' }],
      tasks: [{ id: 'e0000000-0000-4000-8000-000000000001', name: 'Confirm delivery' }]
    }
  },
  products: {
    name: 'ArchScale Products',
    repo: 'archscale-products',
    domain: 'archscale-products.vercel.app',
    port: 3002,
    desc: 'Product catalog, SKU, and unit pricing workspace with soft-reference snapshot integration.',
    mockState: {
      products: [
        { id: 'b0000000-0000-4000-8000-000000000001', name: 'Marble Sample', sku: 'MAR-001', category: 'Samples', unit: 'each', price: 500, contactId: 'c0000000-0000-4000-8000-000000000001', contactName: 'ABC Studio', orderId: 'd0000000-0000-4000-8000-000000000001', orderRef: 'ORD-001', taskId: 'e0000000-0000-4000-8000-000000000001', taskName: 'Confirm delivery' }
      ],
      contacts: [{ id: 'c0000000-0000-4000-8000-000000000001', name: 'ABC Studio' }],
      orders: [{ id: 'd0000000-0000-4000-8000-000000000001', orderNo: 'ORD-001' }],
      tasks: [{ id: 'e0000000-0000-4000-8000-000000000001', name: 'Confirm delivery' }]
    }
  },
  orders: {
    name: 'ArchScale Orders',
    repo: 'archscale-orders',
    domain: 'archscale-orders.vercel.app',
    port: 3003,
    desc: 'Order lines, calculation, and tax processing workspace with soft-reference snapshot integration.',
    mockState: {
      orders: [
        { id: 'd0000000-0000-4000-8000-000000000001', orderNo: 'ORD-001', customerId: 'c0000000-0000-4000-8000-000000000001', customerName: 'ABC Studio', productId: 'b0000000-0000-4000-8000-000000000001', productName: 'Marble Sample', unitPrice: 500, quantity: 4, total: 2000, status: 'Confirmed', taskId: 'e0000000-0000-4000-8000-000000000001', taskName: 'Confirm delivery' }
      ],
      contacts: [{ id: 'c0000000-0000-4000-8000-000000000001', name: 'ABC Studio' }],
      products: [{ id: 'b0000000-0000-4000-8000-000000000001', name: 'Marble Sample', price: 500 }],
      tasks: [{ id: 'e0000000-0000-4000-8000-000000000001', name: 'Confirm delivery' }]
    }
  },
  tasks: {
    name: 'ArchScale Tasks',
    repo: 'archscale-tasks',
    domain: 'archscale-tasks.vercel.app',
    port: 3004,
    desc: 'Operational coordination, follow-up, and task tracking workspace with soft-reference snapshot integration.',
    mockState: {
      tasks: [
        { id: 'e0000000-0000-4000-8000-000000000001', name: 'Confirm delivery', assignedTo: 'Operations', dueDate: '2026-11-05', status: 'Open', orderId: 'd0000000-0000-4000-8000-000000000001', orderRef: 'ORD-001', contactId: 'c0000000-0000-4000-8000-000000000001', contactName: 'ABC Studio', productId: 'b0000000-0000-4000-8000-000000000001', productName: 'Marble Sample' }
      ],
      contacts: [{ id: 'c0000000-0000-4000-8000-000000000001', name: 'ABC Studio' }],
      products: [{ id: 'b0000000-0000-4000-8000-000000000001', name: 'Marble Sample', price: 500 }],
      orders: [{ id: 'd0000000-0000-4000-8000-000000000001', orderNo: 'ORD-001' }]
    }
  }
};

const gitignore = `node_modules
.env
.env.local
.vercel
dist
coverage
`;

async function generateAppRepo(appId) {
  const meta = appMeta[appId];
  const targetDir = path.join(reposRoot, meta.repo);
  await mkdir(path.join(targetDir, 'public'), { recursive: true });
  await mkdir(path.join(targetDir, 'src', 'mocks'), { recursive: true });
  await mkdir(path.join(targetDir, 'migrations'), { recursive: true });
  await mkdir(path.join(targetDir, 'test'), { recursive: true });

  // 1. package.json
  const pkg = {
    name: meta.repo,
    version: '1.0.0',
    private: true,
    description: meta.desc,
    type: 'module',
    scripts: {
      start: 'node src/server.mjs',
      dev: 'node --watch src/server.mjs',
      test: 'node --test test/**/*.test.mjs'
    },
    dependencies: {},
    devDependencies: {}
  };
  await writeFile(path.join(targetDir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');

  // 2. vercel.json
  const vercelConfig = {
    version: 2,
    name: meta.repo,
    public: true,
    headers: [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }
        ]
      }
    ],
    rewrites: [
      { source: '/api/(.*)', destination: 'https://archscale-four-apps-staging.vercel.app/api/$1' },
      { source: '/(.*)', destination: '/index.html' }
    ]
  };
  await writeFile(path.join(targetDir, 'vercel.json'), JSON.stringify(vercelConfig, null, 2) + '\n');

  // 3. .gitignore
  await writeFile(path.join(targetDir, '.gitignore'), gitignore);

  // 4. Static assets & HTML
  await copyFile(path.join(projectRoot, 'public', 'styles.css'), path.join(targetDir, 'public', 'styles.css'));
  await copyFile(path.join(projectRoot, 'public', 'app.js'), path.join(targetDir, 'public', 'app.js'));

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${meta.name} Workspace</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <header class="top">
    <div>
      <a class="toplink" href="https://archscale-four-apps-staging.vercel.app">← Central Platform Portal</a>
      <span class="eyebrow">ARCHSCALE · INDEPENDENT DOMAIN (${appId.toUpperCase()})</span>
      <h1 id="app-title">${meta.name}</h1>
      <p>Domain: ${meta.domain} · Linked records are shared via API</p>
    </div>
  </header>
  <main>
    <div id="status-message"></div>
    <section id="workspace" class="workspace"></section>
  </main>
  <script>window.ARCHSCALE_APP_ID = ${JSON.stringify(appId)};</script>
  <script src="/app.js" defer></script>
</body>
</html>
`;
  await writeFile(path.join(targetDir, 'public', 'index.html'), html);

  // 5. Offline Mock State & Development Server
  await writeFile(path.join(targetDir, 'src', 'mocks', 'state.json'), JSON.stringify(meta.mockState, null, 2) + '\n');

  const serverMjs = `import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '..', 'public');
const mockStatePath = path.resolve(__dirname, 'mocks', 'state.json');

const port = process.env.PORT || ${meta.port};
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, \`http://127.0.0.1:\${port}\`);

  if (url.pathname === '/api/state') {
    const raw = fs.readFileSync(mockStatePath, 'utf8');
    const mock = JSON.parse(raw);
    const definitions = [{ id: '${appId}', name: '${meta.name}', collection: '${appId}' }];
    const state = {
      organizationId: 'a0000000-0000-4000-8000-000000000001',
      modules: { ${appId}: { status: 'active', deploymentStatus: 'local' } },
      ...mock,
      audit: []
    };
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    return res.end(JSON.stringify({ definitions, state }));
  }

  const requested = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  const file = path.resolve(publicDir, requested);
  if (!fs.existsSync(file)) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    return res.end('Not found');
  }

  const ext = path.extname(file);
  res.writeHead(200, { 'content-type': mime[ext] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

server.listen(port, () => {
  console.log(\`[${meta.name}] Local dev server running on http://127.0.0.1:\${port}\`);
});
`;
  await writeFile(path.join(targetDir, 'src', 'server.mjs'), serverMjs);

  // 6. Unit Test
  const testMjs = `import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('${meta.name} workspace builds with clean mock contracts', () => {
  const mockPath = path.resolve(__dirname, '..', 'src', 'mocks', 'state.json');
  assert.ok(fs.existsSync(mockPath), 'Mock state file must exist');
  const mock = JSON.parse(fs.readFileSync(mockPath, 'utf8'));
  assert.ok(Array.isArray(mock.${appId}), '${appId} collection must be an array');
});
`;
  await writeFile(path.join(targetDir, 'test', 'workspace.test.mjs'), testMjs);

  // 7. Developer README.md
  const readme = `# ${meta.name} Repository (\`${meta.repo}\`)

## Overview
This repository contains the standalone source code, domain logic, and frontend workspace for the **${meta.name}** application in the ArchScale platform.

* **Assigned Team**: ${meta.name} Engineering Team & Contractors
* **Target Domain**: \`https://${meta.domain}\`
* **Central Portal**: \`https://archscale-four-apps-staging.vercel.app\`

---

## Developer Isolation & Security Boundary
* Developers assigned to this repository **only have access to this repository**.
* This app communicates with sibling apps (Contacts, Products, Orders, Tasks) via **Soft References (ID + Snapshot)** over REST APIs.
* You do **not** need access to the central platform repository or database superuser credentials to build and test this app.

---

## Getting Started (Local Offline Development)
Run this app offline with zero external cloud dependencies:

\`\`\`bash
# 1. Install dependencies
npm install

# 2. Run local development server
npm run dev
\`\`\`

Open \`http://127.0.0.1:${meta.port}\` in your browser. Mock data is served automatically from \`src/mocks/state.json\`.

---

## Running Unit Tests
\`\`\`bash
npm test
\`\`\`

---

## Deployment
Pushing to the \`main\` branch automatically triggers a deployment to Vercel production at \`https://${meta.domain}\`.
`;
  await writeFile(path.join(targetDir, 'README.md'), readme);

  console.log(`Generated repo: ${meta.repo}`);
}

async function generatePlatformRepo() {
  const targetDir = path.join(reposRoot, 'archscale-platform');
  await mkdir(path.join(targetDir, 'public'), { recursive: true });
  await mkdir(path.join(targetDir, 'api'), { recursive: true });
  await mkdir(path.join(targetDir, 'src'), { recursive: true });
  await mkdir(path.join(targetDir, 'supabase', 'migrations'), { recursive: true });

  // Copy full platform files
  await cp(path.join(projectRoot, 'public'), path.join(targetDir, 'public'), { recursive: true });
  await cp(path.join(projectRoot, 'api'), path.join(targetDir, 'api'), { recursive: true });
  await cp(path.join(projectRoot, 'src'), path.join(targetDir, 'src'), { recursive: true });
  await cp(path.join(projectRoot, 'supabase'), path.join(targetDir, 'supabase'), { recursive: true });
  await cp(path.join(projectRoot, 'docs'), path.join(targetDir, 'docs'), { recursive: true });

  const pkg = {
    name: 'archscale-platform',
    version: '1.0.0',
    private: true,
    description: 'Central Platform Portal, Super Admin Governance, and API Gateway.',
    type: 'module',
    scripts: {
      start: 'node scripts/start-supabase-pilot.mjs',
      test: 'node --test test/**/*.test.js'
    }
  };
  await writeFile(path.join(targetDir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
  await writeFile(path.join(targetDir, '.gitignore'), gitignore);

  const readme = `# ArchScale Platform Core (\`archscale-platform\`)

## Overview
This repository contains the central governance core for the ArchScale modular ecosystem.

* **Target Domain**: \`https://archscale-four-apps-staging.vercel.app\` (or \`https://archscale-portal.vercel.app\`)
* **Access Level**: Core Platform Engineers & Super Admins Only

## Responsibilities:
1. **Central Portal**: Single sign-on landing page and app launcher.
2. **Super Admin (\`/admin\`)**: Dynamic lifecycle controls, audit logging, and JIT recovery approval queues.
3. **API Gateway (\`/api/*\`)**: Central routing, authentication token handoff, and master state aggregation.
4. **Master Blueprints**: Canonical SQL schema definitions and permanent backup vaults.
`;
  await writeFile(path.join(targetDir, 'README.md'), readme);

  console.log('Generated repo: archscale-platform');
}

async function main() {
  console.log('Generating polyrepo architecture in:', reposRoot);
  await generatePlatformRepo();
  for (const appId of Object.keys(appMeta)) {
    await generateAppRepo(appId);
  }
  console.log('All 5 repositories generated successfully.');
}

main().catch(console.error);

