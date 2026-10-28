# Manager Update — Four-App Modular Demo

**Status:** Presentable demo deployed with four independent app workspaces backed by one shared Cloudflare platform API and D1 database. This is a proof of concept, not production RBAC.

## Completed

- Contacts, Products, Orders, and Tasks run as four separate Cloudflare Workers with separate workspace URLs and build/deploy commands.
- Each app calls the shared platform API through a private Cloudflare Service binding. Cross-app record references and saved snapshots remain available across workspaces.
- Super Admin demo controls support activate, deactivate, retire, and delete of app-owned records. Deactivate/retire preserve records; delete clears only the selected app's records.
- Hosted D1 uses app-owned tables and a registry that tracks each app's deployment separately. Removing an app Worker does not delete shared D1 or another app's data.
- The **Load demo story** reset restores the sample data and active app statuses while preserving each Worker's deployment name, URL, source path, and deployed status.
- GitHub push builds are configured on `modular-four-apps-demo` with repository root `/modular-demo`.

## Deletion boundaries

- **Delete app records:** the demo Super Admin clears records owned by the selected app; other apps and saved snapshots remain.
- **Deactivate or retire an app:** changes the app's availability/status while keeping its shared-platform records.
- **Delete a Cloudflare Worker:** removes that app's deployed workspace, but does not delete the shared platform Worker, D1 database, or app records. This is currently an operator/deployment action, not a Super Admin UI control.
- **Delete the GitHub repository:** removes source and the build connection; it does not automatically delete already deployed Workers or shared D1 data. Those resources need separate cleanup.

Keep these operations separate. Before adding deployment-level delete controls, define the desired recovery window, backup, and explicit confirmation flow.

## Live workspaces

- [Contacts](https://archscale-contacts.keshariritik101.workers.dev/)
- [Products](https://archscale-products.keshariritik101.workers.dev/)
- [Orders](https://archscale-orders.keshariritik101.workers.dev/)
- [Tasks](https://archscale-tasks.keshariritik101.workers.dev/)
- [Super Admin / dashboard](https://archscaleguild01.keshariritik101.workers.dev/)

Enter the configured demo password in the in-page sign-in form. Authentication applies to that browser tab. Use sample records only.

## Verification

- `npm test`: 7 passed, 0 failed.
- All four independent build packages generated locally.
- Cloudflare Workers Builds for Contacts, Products, Orders, Tasks, and the shared platform completed successfully from the GitHub branch.
- Each app `/health` endpoint returned its own app identifier. Shared platform deployed successfully and the D1 registry reports all four apps active and deployed.
- All four live apps displayed the sign-in flow and returned the shared API's expected in-page rejection for an invalid test password, confirming the app-to-platform service binding path. A valid-password record exchange and Super Admin action check still require a manual live session.

## Next priorities

1. Do a manual end-to-end check: create a contact, link it to product/order/task records, open the same linked data in the other workspaces, then check Super Admin deactivation and deletion behavior.
2. Define deployment-level retire/uninstall, backup, and restore policies before adding any Worker or repository deletion control.
3. Decide whether each app needs its own GitHub repository or whether the current single repository with separate Workers is sufficient for this milestone.
4. Add real user authentication and RBAC in a later milestone.

## Run locally

Install Node.js 18+, open this folder, run `Run-Demo.cmd` or `npm start`, then open `http://127.0.0.1:3000`. Run automated checks with `npm test`.
