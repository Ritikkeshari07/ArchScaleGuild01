# Manager Update — Modular Four-App Proof of Concept

**Status:** Four-app proof of concept deployed for review; shared hosted D1 has been upgraded to app-owned tables. Still not production-ready.

## Completed

- Created separate Contacts, Products, Orders, and Tasks modules with manifests and a shared platform registry.
- Added a separate browser workspace and URL for each app, plus a distinct Super Admin page. App pages have no direct app-switch navigation; the apps interconnect through record selectors and saved snapshots on the shared platform API and local demo database.
- Implemented optional links between every pair of apps, with saved display snapshots so deleting one app's records does not erase the related values in other apps.
- Orders retain customer/product/task text, price, quantity, and total; Tasks retain contact, product, and order references.
- Added Super Admin demo controls to activate, deactivate, retire, and delete one module's records. Deactivation and retirement retain records; deletion clears only that module's own collection.
- Added the ABC Studio / Marble Sample / ORD-001 demo story and manual-entry fallback after Contacts or Products are removed.
- Added automated checks for product removal, order removal, saved task references, manual fallback, and lifecycle record handling.
- Added an additive Cloudflare D1 migration to separate app-owned tables, preserve existing demo records, retain cross-app snapshots without cascading deletes, and track each app's deployment metadata.

## Verification

Automated checks: **5 passed, 0 failed** using Node's built-in test runner, including an all-pairs app-link and deletion-snapshot check. JavaScript syntax checks pass. The D1 migration was exercised against a local SQLite copy and applied to the hosted demo; all four app tables and the audit entry were verified to contain the existing example data. The latest Cloudflare build succeeded, and the deployed Worker health route responded successfully. The separate app pages are implemented at `/apps/contacts`, `/apps/products`, `/apps/orders`, and `/apps/tasks`; `/admin` hosts Super Admin controls. The authenticated workspace UI still needs a manual browser check.

## Remaining before production

- Split the current shared Worker into independently deployed app workspaces that communicate through a stable platform API; keep the platform/data service independent of app deployment deletion.
- Define deployment-level uninstall/retire/delete policies, backups, and restore procedures. Today's delete clears only demo records from the selected app's table; it does not delete its deployment or GitHub repository.
- Add real authentication, Super Admin authorization, and RBAC as a later milestone.
- Run the full acceptance matrix for removing each app and each selected pair, then test reinstall without duplicate records.

## Run locally

Install Node.js 18+, open this project folder, and run `Run-Demo.cmd` (or `npm start`). Then open `http://127.0.0.1:3000`. Run checks with `npm test`. Use only demo data.

## Reference

The folder/manifest pattern was informed by ProjectMeru's Sumeru addon framework. This proof of concept is original implementation code. Sumeru's standard Sales module has hard dependencies and is pre-alpha, so its code is a structural reference only; it does not prove this removal behavior.


