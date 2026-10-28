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

Each app has its own page, URL, and backend module. The apps share the local platform API and JSON database so each app can link to the other three. Click **Load demo story** on the home page or Super Admin page for ABC Studio → Marble Sample (₹500) → ORD-001 (4 items, ₹2,000) → Confirm delivery. The sample records include links across all four apps. Use Super Admin controls to deactivate, retire, reactivate, or delete one app's records. Data is stored only in `data/store.json`.

Run the automated checks with `npm test`.

## Folder structure

- `src/platform/` — module registry, JSON database adapter, validation, and lifecycle policy.
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

This is a fast, local proof of concept. It uses a JSON file, has no sign-in/RBAC, does not implement schema migrations or true physical per-module database schemas, and does not include production-grade audit retention or concurrency control. The “delete” action removes that module's records from the local demo store to demonstrate the dependency behavior. Do not use real business data.


## Hosted preview (demo only)

For a quick hosted walkthrough, connect this repository to a Node.js web service such as Render. Set the service root directory to `modular-demo`, the build command to `npm install`, the start command to `npm start`, and `HOST` to `0.0.0.0`. The host supplies `PORT` automatically. After deployment, share the generated HTTPS URL with the reviewer.

This preview is not production-ready: it has no login/RBAC and stores records in `data/store.json`. A hosted free instance may lose that file when it restarts, redeploys, or idles. Use sample data only. For persistent data, connect managed PostgreSQL; before production, add authentication, authorization, migrations, backups, and an audit trail before exposing Super Admin operations.