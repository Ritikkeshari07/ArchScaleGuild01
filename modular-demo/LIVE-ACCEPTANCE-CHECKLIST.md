# Live Acceptance Checklist — Four-App Demo

Use this checklist with the hosted demo and sample/demo data only. Sign in through the browser's in-page form; do not share the demo password in chat or put real business data in the demo.

## 1. Confirm the workspaces are separate

Open the dashboard, then open Contacts, Products, Orders, and Tasks. Confirm each opens its own workspace URL and shows the correct app name. Use **Back to dashboard** to return from each workspace.

## 2. Confirm links across all four apps

Use a unique prefix such as `QA-20261028` to distinguish the test records.

1. In Contacts, create `QA-20261028 Studio`. Link the existing Marble Sample product, ORD-001 order, and Confirm delivery task.
2. In Products, create `QA-20261028 Sample`, SKU `QA-20261028-01`, price ₹250. Link the QA contact, ORD-001, and Confirm delivery task.
3. In Orders, create `QA-20261028-ORD`, link the QA contact and QA product, set quantity to 2, and link Confirm delivery. Confirm the saved total is ₹500.
4. In Tasks, create `QA-20261028 Follow-up` and link the QA contact, QA product, and QA order.
5. Open each of the four workspaces. Confirm the related record names/references are visible and match the records you created.

**Pass:** all four apps can save links to the other three, and each workspace shows the linked names/references from shared data.

## 3. Confirm app lifecycle controls

1. In Super Admin, deactivate Products. Open Products and confirm it displays the inactive message and blocks its app actions.
2. Confirm Contacts, Orders, and Tasks still open and keep their records.
3. Reactivate Products and confirm it is usable again.
4. Retire Products. Confirm its records remain stored and its workspace is unavailable for use.
5. Reactivate Products before the next check if you want to continue using it.

**Pass:** deactivate/retire affect the selected app only and preserve its data; other apps remain usable.

## 4. Confirm delete-data isolation

This clears the selected app's entire record collection. Only do this with demo data.

1. Before deleting, make sure the QA contact/product/order/task links are visible in the other workspaces.
2. In Super Admin, choose **Delete data** for Contacts and accept its confirmation.
3. Confirm Contacts has no records and is marked deleted.
4. Confirm the other apps still open and show their saved QA contact-name snapshots and their own records.
5. Click **Load demo story** on the dashboard and accept its confirmation to restore the ABC Studio sample. Confirm the four app links/statuses remain deployed in Super Admin and all apps are active.

**Pass:** deleting one app's data does not erase the other apps or their saved snapshots; resetting the demo restores sample records without changing Worker deployment URLs/status.

## 5. Deployment-level boundary

Worker removal and GitHub repository deletion are not Super Admin demo actions and are not part of this live test. Do not delete a Worker, D1 database, or GitHub repository to test lifecycle behavior. Those operations are separate from deleting one app's records and require a separately reviewed recovery/cleanup plan.

## Record the result

- Workspaces and dashboard navigation: Pass / Fail
- Four-way record links: Pass / Fail
- Deactivate/retire isolation: Pass / Fail
- Delete-data snapshot preservation: Pass / Fail
- Reset preserves deployment registry: Pass / Fail
- Issues or screenshots: note here
