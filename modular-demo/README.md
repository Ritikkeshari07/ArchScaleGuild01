# Four Interdependent Apps — Modularity Demo

A local, dependency-free Node.js prototype for demonstrating the assigned modularity work: Contacts, Products, Orders, Tasks, optional app integrations, saved snapshots, and Super Admin lifecycle controls.

## Run

Requirements: Node.js 18 or newer. From this folder:

```powershell
npm start
```

Open http://127.0.0.1:3000. Click **Load demo story** for ABC Studio → Marble Sample (₹500) → ORD-001 (4 items, ₹2,000) → Confirm delivery. Use the registry controls to deactivate, retire, reactivate, or delete one app's records. Data is stored only in `data/store.json`.

Run the automated checks with `npm test`.

## Folder structure

- `src/platform/` — module registry, JSON database adapter, validation, and lifecycle policy.
- `src/apps/{contacts,products,orders,tasks}/` — independent app logic and manifests.
- `public/` — demo interface.
- `test/` — module removal and snapshot behavior tests.
- `data/store.json` — local disposable demo database, created on first run.

## Behaviors demonstrated

- Orders save customer and product display values, unit price, quantity, and total at creation. Links to Contacts and Products are optional.
- Tasks save the order reference text; they can still be created with manual order text.
- Deactivate/retire disables the selected app while preserving its records.
- Delete clears only the selected app's owned collection. Other apps' saved snapshots remain.
- Super Admin UI actions are intentionally unauthenticated for the localhost demo. This is not production security.

## Reference and scope

The modular addon/folder and manifest concept was informed by [ProjectMeru/sumeru](https://github.com/ProjectMeru/sumeru) and [ProjectMeru/sumeru_addons](https://github.com/ProjectMeru/sumeru_addons). This prototype is original implementation code, not copied Sumeru source. Sumeru is pre-alpha and its sample Sales addon declares dependencies on Products, Contacts, and CRM, so it is an architecture reference rather than proof of safe removal. See its [Apache-2.0 license](https://github.com/ProjectMeru/sumeru_addons/blob/main/LICENSE).

## Known gaps before production

This is a fast, local proof of concept. It uses a JSON file, has no sign-in/RBAC, does not implement schema migrations or true physical per-module database schemas, and does not include production-grade audit retention or concurrency control. The “delete” action removes that module's records from the local demo store to demonstrate the dependency behavior. Do not use real business data.
