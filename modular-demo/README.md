# Four Interdependent Apps — Modularity Demo

A local, dependency-free Node.js prototype for demonstrating the assigned modularity work: Contacts, Products, Orders, Tasks, optional app integrations, saved snapshots, and Super Admin lifecycle controls.

## Run

Requirements: Node.js 18 or newer. From this folder:

```powershell
npm start
```

Open the address printed in the command window (normally http://127.0.0.1:3000). If that port is already in use, the server tries the next available port automatically. The home page launches four separate app workspaces:

- Contacts: `<server-address>/apps/contacts`
- Products: `<server-address>/apps/products`
- Orders: `<server-address>/apps/orders`
- Tasks: `<server-address>/apps/tasks`
- Super Admin: `<server-address>/admin`

Each app has its own page, URL, and backend module. The apps share the platform API so each app can link to the other three. Click **Load demo story** on the home page or Super Admin page for ABC Studio → Marble Sample (₹500) → ORD-001 (4 items, ₹2,000) → Confirm delivery. The sample records include links across all four apps. Use Super Admin controls to deactivate, retire, reactivate, or delete one app's records. The local Node server stores data in `data/store.json`; the hosted Cloudflare demo stores data in app-owned D1 tables.

Run the automated checks with `npm test`.

## Hosted preview (demo only)

The Cloudflare Worker entry point (`src/worker.mjs`) serves the same app workspaces and uses the D1 binding configured in `wrangler.jsonc`. Migration `0002_app_owned_tables.sql` moves hosted demo records into separate Contacts, Products, Orders, and Tasks tables while preserving IDs and display snapshots. A revision check rejects simultaneous stale writes. The hosted preview requires a `DEMO_PASSWORD` secret and fails closed until it is configured.

To preview locally with Cloudflare, run `npm run cf:dev` after authenticating Wrangler and creating `.dev.vars` with a `DEMO_PASSWORD` value. Apply the migration with `npx wrangler d1 migrations apply archscale-four-apps-demo --local`. Deploy with `npm run cf:deploy` after applying it remotely with `npx wrangler d1 migrations apply archscale-four-apps-demo --remote` and adding the `DEMO_PASSWORD` secret in Cloudflare. For automated Git deployments, connect this Worker to the `modular-four-apps-demo` GitHub branch through Workers Builds.

This is still a manager-review demo, not production: the password gate is shared access, not user accounts or RBAC. The hosted Worker and UI are still one deployment; the D1 tables establish separate data ownership but do not yet let each app deploy or be removed independently. The app tables deliberately avoid cross-app foreign keys so removing one app's records does not cascade into another app. Use sample data only. Before production, separate app deployments behind a stable platform API, add real authentication/authorization, review migrations, backups, and audit retention.

## Folder structure

- `src/platform/` — module registry, local JSON adapter, Cloudflare D1 adapter, validation, and lifecycle policy.
- `src/apps/{contacts,products,orders,tasks}/` — independent app logic and manifests.
- `public/apps/{contacts,products,orders,tasks}/` — separate app entry pages, with shared styling and client helpers.
- `public/admin/` — Super Admin registry and lifecycle controls.
- `public/` — app launcher and shared styling/client helpers.
- `test/` — module removal and snapshot behavior tests.
- `data/store.json` — local disposable demo database, created on first run.

## Behaviors demonstrated

- Every app can optionally link to each of the other three apps. The create forms allow selecting existing records or entering snapshot text.
- Contacts can link to Products, Orders, and Tasks; Products can link to Contacts, Orders, and Tasks; Orders can link to Contacts, Products, and Tasks; Tasks can link to Contacts, Products, and Orders.
- Linked records keep display snapshots so the other apps continue working if a related app's records are removed.
- Orders save unit price, quantity, and total at creation. Tasks save their order, contact, and product display references.
- Deactivate/retire disables the selected app while preserving its records.
- Delete clears only the selected app's owned collection. Other apps' saved snapshots remain.
- Each app has its own browser workspace URL while sharing the platform API and local database.
- App workspaces do not include links or tabs to switch directly to another app. Open workspaces from the launcher or their URLs; inter-app connections are made through record selectors and saved references.
- Super Admin UI actions are intentionally unauthenticated for the localhost demo. This is not production security.

## Reference and scope

The modular addon/folder and manifest concept was informed by [ProjectMeru/sumeru](https://github.com/ProjectMeru/sumeru) and [ProjectMeru/sumeru_addons](https://github.com/ProjectMeru/sumeru_addons). This prototype is original implementation code, not copied Sumeru source. Sumeru is pre-alpha and its sample Sales addon declares dependencies on Products, Contacts, and CRM, so it is an architecture reference rather than proof of safe removal. See its [Apache-2.0 license](https://github.com/ProjectMeru/sumeru_addons/blob/main/LICENSE).

## Known gaps before production

This is a proof of concept. The local Node server uses a JSON file; the hosted demo uses separate D1 tables with migrations and optimistic concurrency checks. It has no sign-in/RBAC, independently deployed app services, production-grade audit retention, backup/restore workflow, or verified production deletion policy. The “delete” action clears only that app's records in the demo. Do not use real business data.

