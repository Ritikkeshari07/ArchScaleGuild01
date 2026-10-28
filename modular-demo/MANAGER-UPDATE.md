# Manager Update — Modular Four-App Proof of Concept

**Status:** Functional local proof of concept prepared for review; not production-ready.

## Completed

- Created separate Contacts, Products, Orders, and Tasks modules with manifests and a shared platform registry.
- Implemented optional app links and saved display snapshots: Orders retain customer/product text, price, quantity, and total; Tasks retain the order reference.
- Added Super Admin demo controls to activate, deactivate, retire, and delete one module's records. Deactivation and retirement retain records; deletion clears only that module's own collection.
- Added the ABC Studio / Marble Sample / ORD-001 demo story and manual-entry fallback after Contacts or Products are removed.
- Added automated checks for product removal, order removal, saved task references, manual fallback, and lifecycle record handling.

## Verification

Automated checks: **3 passed, 0 failed** using Node's built-in test runner. The tests exercise module logic and removal behavior using isolated in-memory state. The local HTTP server could not be reached from this restricted execution session, so browser/API end-to-end verification remains to be done on the development machine.

## Remaining before production

- Replace the JSON demo store with the team's real database and perform owned-schema removal against a disposable database.
- Add real authentication, Super Admin authorization, RBAC, migrations, audit controls, and concurrency handling.
- Connect the prototype to the team's chosen app stack and confirm the target GitHub repository and deployment workflow.
- Run the full acceptance matrix for removing each app and each selected pair, then test reinstall without duplicate records.

## Run locally

Install Node.js 18+, open this project folder, and run `Run-Demo.cmd` (or `npm start`). Then open `http://127.0.0.1:3000`. Run checks with `npm test`. Use only demo data.

## Reference

The folder/manifest pattern was informed by ProjectMeru's Sumeru addon framework. This proof of concept is original implementation code. Sumeru's standard Sales module has hard dependencies and is pre-alpha, so its code is a structural reference only; it does not prove this removal behavior.
