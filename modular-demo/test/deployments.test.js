const test = require('node:test');
const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');

test('each app builds as its own Worker with a private platform service binding', async () => {
  const { buildApp } = await import(pathToFileURL(path.join(root, 'scripts', 'build-app.mjs')));
  for (const appId of ['contacts', 'products', 'orders', 'tasks']) {
    const result = await buildApp(appId, root);
    const config = JSON.parse(await readFile(path.join(root, 'deployables', appId, 'wrangler.jsonc'), 'utf8'));
    const html = await readFile(path.join(root, 'deployables', appId, 'public', 'index.html'), 'utf8');
    const worker = await readFile(path.join(root, 'deployables', appId, 'src', 'index.mjs'), 'utf8');
    const client = await readFile(path.join(root, 'public', 'app.js'), 'utf8');
    assert.equal(result.worker, `archscale-${appId}`);
    assert.equal(config.name, `archscale-${appId}`);
    assert.equal(config.assets.binding, 'ASSETS');
    assert.deepEqual(config.services, [{ binding: 'PLATFORM', service: 'archscaleguild01' }]);
    assert.match(html, new RegExp(`ARCHSCALE_APP_ID="${appId}"`));
    assert.match(worker, /env\.PLATFORM\.fetch/);
    assert.match(worker, /env\.PLATFORM\.fetch\(request\)/);
    assert.match(worker, /env\.ASSETS\.fetch/);
    assert.match(client, /demo-login-form/);
    assert.match(client, /demoAuthorization/);
    assert.match(client, /window\.setInterval\(\(\s*\)=>pollSharedState/);
    assert.match(client, /document\.hidden/);
    assert.match(client, /function hasUnsavedFormDraft/);
    assert.match(client, /document\.activeElement\?\.closest\('#create'\)/);
    const platform = await readFile(path.join(root, 'src', 'worker.mjs'), 'utf8');
    assert.doesNotMatch(platform, /www-authenticate/);
  }
});

