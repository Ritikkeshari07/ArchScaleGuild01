# Manager Update — Modular Four-App Proof of Concept

**Status:** Functional local proof of concept prepared for review; not production-ready.

## Completed

- Created separate Contacts, Products, Orders, and Tasks modules with manifests and a shared platform registry.
- Added a separate browser workspace and URL for each app, plus a distinct Super Admin page. The four apps continue to share the platform API and local demo database for their inter-app links and saved snapshots.
- Implemented optional links between every pair of apps, with saved display snapshots so deleting one app's records does not erase the related values in other apps.
- Orders retain customer/product/task text, price, quantity, and total; Tasks retain contact, product, and order references.
- Added Super Admin demo controls to activate, deactivate, retire, and delete one module's records. Deactivation and retirement retain records; deletion clears only that module's own collection.
- Added the ABC Studio / Marble Sample / ORD-001 demo story and manual-entry fallback after Contacts or Products are removed.
- Added automated checks for product removal, order removal, saved task references, manual fallback, and lifecycle record handling.

## Verification

Automated checks: **5 passed, 0 failed** using Node's built-in test runner, including an all-pairs app-link and deletion-snapshot check. JavaScript syntax checks pass. The separate app pages are implemented at `/apps/contacts`, `/apps/products`, `/apps/orders`, and `/apps/tasks`; `/admin` hosts Super Admin controls. Startup tries the next available port if 3000 is busy and prints the exact local URL. Manual lifecycle clicks and the delete-data confirmation flow remain to be walked through in the browser.

## Remaining before production

- Replace the JSON demo store with the team's real database and perform owned-schema removal against a disposable database.
- Add real authentication, Super Admin authorization, RBAC, migrations, audit controls, and concurrency handling.
- Connect the prototype to the team's chosen app stack and confirm the target GitHub repository and deployment workflow.
- Run the full acceptance matrix for removing each app and each selected pair, then test reinstall without duplicate records.

## Run locally

Install Node.js 18+, open this project folder, and run `Run-Demo.cmd` (or `npm start`). Then open `http://127.0.0.1:3000`. Run checks with `npm test`. Use only demo data.

## Reference

The folder/manifest pattern was informed by ProjectMeru's Sumeru addon framework. This proof of concept is original implementation code. Sumeru's standard Sales module has hard dependencies and is pre-alpha, so its code is a structural reference only; it does not prove this removal behavior.

