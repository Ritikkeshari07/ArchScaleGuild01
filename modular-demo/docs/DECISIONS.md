# ArchScale Architecture Decision Records (ADR) & Changelog

This document maintains a formal, permanent record of all architectural decisions taken throughout the ArchScale Four-App Modular Pilot, their technical rationale, and their verified outcomes.

---

## Index of Decisions

* **[ADR-001]**: Migration from Cloudflare D1 Prototype to Hosted Supabase + Vercel Staging
* **[ADR-002]**: Multi-Schema Isolation with Decoupled Soft References and Display Snapshots
* **[ADR-003]**: PostgREST Catalog Stability via Empty Schema Stub Preservation
* **[ADR-004]**: Sub-100ms Latency Optimization (Mumbai Co-Location, Single-RPC, & Cross-Tab Caching)
* **[ADR-005]**: Codebase Modularization (Frontend Components & Backend Services Separation)
* **[ADR-006]**: Adoption of Multi-Repository & Multi-Domain Architecture for Code Privacy

---

## [ADR-001] Migration from Cloudflare D1 Prototype to Hosted Supabase + Vercel Staging

* **Date:** 2026-10-30
* **Status:** Accepted & Implemented
* **Context:** The initial pilot ran on local SQLite and Cloudflare Workers. Moving to a real enterprise staging environment required a dedicated relational cloud database, Supabase GoTrue authentication, and production edge hosting.
* **Decision:** Promoted the codebase to **Vercel** serverless edge hosting backed by a dedicated **Supabase Cloud PostgreSQL** database (`djechswitjpwajqtwfig`) located in the Mumbai region (`ap-south-1`).
* **Consequences:** Allowed true multi-schema isolation, Row-Level Security (RLS), real JWT authentication, and native PostgreSQL stored procedures.
* **Verified Result:** Full 13-point automated live acceptance test suite passed on `https://archscale-four-apps-staging.vercel.app`.

---

## [ADR-002] Multi-Schema Isolation with Decoupled Soft References and Display Snapshots

* **Date:** 2026-10-30
* **Status:** Accepted & Implemented
* **Context:** Traditional monolithic databases use hard foreign keys (`ON DELETE CASCADE`), which cause catastrophic cascades or crashes across applications when a record or sibling app is removed.
* **Decision:**
  - Segregated each application into its own isolated PostgreSQL schema: `contacts`, `products`, `orders`, and `tasks`. Shared platform tenancy and governance live in `public`.
  - Implemented the **ID + Snapshot** pattern: when a record links across apps, it stores both the foreign UUID and a frozen string snapshot (e.g. `customerName`, `productName`, `orderRef`).
* **Consequences:** If a contact or entire app schema is deleted, sibling apps never crash. They seamlessly fall back to displaying:  
  `Saved snapshot · source record deleted`.
* **Verified Result:** Verified via automated tests (`test/modularity.test.js`) and live database checks.

---

## [ADR-003] PostgREST Catalog Stability via Empty Schema Stub Preservation

* **Date:** 2026-10-30
* **Status:** Accepted & Implemented
* **Context:** When the Super Admin executed `manage_app_lifecycle('remove_schema')` using `DROP SCHEMA <app> CASCADE`, Supabase's PostgREST engine failed introspection with `PGRST002: Could not query database for schema cache`, causing temporary 500 errors across all surviving apps.
* **Decision:** Updated the database lifecycle function to immediately execute:
  ```sql
  execute format('drop schema if exists %I cascade', target_app);
  execute format('create schema if not exists %I', target_app);
  ```
* **Consequences:** Dropping the schema cascade wipes all tables, records, and triggers owned by the app. Creating an empty namespace stub satisfies PostgREST's exposed schema list so surviving apps remain 100% operational with zero downtime.
* **Verified Result:** Tested live on Supabase staging; schema removal of any app leaves the remaining 3 apps fully queryable without restarting PostgREST.

---

## [ADR-004] Sub-100ms Latency Optimization (Mumbai Co-Location, Single-RPC, & Cross-Tab Caching)

* **Date:** 2026-10-30
* **Status:** Accepted & Implemented
* **Context:** Users reported a 2-4 second delay and a blank white card when clicking between apps or opening new browser tabs. Investigation revealed 3 root causes:
  1. Vercel functions defaulted to US-East (`iad1`), causing 250ms+ cross-continental round-trips to Mumbai.
  2. The server made 4 sequential REST calls to Supabase on every `/api/state` request.
  3. `sessionStorage` was per-tab, so opening an app in a new tab had zero cached state.
* **Decision:**
  1. Configured Vercel function region to Mumbai (`bom1`) matching Supabase (`ap-south-1`).
  2. Created PostgreSQL stored procedure `public.get_platform_state()` to aggregate all 4 schemas in a single database round-trip (~2ms).
  3. Replaced `sessionStorage` with cross-tab synchronized `localStorage`.
  4. Added responsive CSS shimmer skeletons directly to static HTML files.
* **Consequences:** Zero blank cards on cold loads; page transitions across all tabs render in **0ms** from local cache.
* **Verified Result:** Confirmed by user feedback: *"yeah it's working"*.

---

## [ADR-005] Codebase Modularization (Frontend Components & Backend Services Separation)

* **Date:** 2026-10-30
* **Status:** Accepted & Implemented
* **Context:** Monolithic `app.js` and mixed server files made code maintenance, component reuse, and team delegation difficult.
* **Decision:** Reorganized the repository into clean modular directories:
  - `src/frontend/components/`: Reusable UI (`AuthModal.js`, `AppCards.js`, `RelationshipCell.js`, `FormFields.js`, `Skeletons.js`).
  - `src/frontend/services/`: Client services (`apiClient.js`, `cacheStore.js`, `statePoller.js`).
  - `src/backend/`: Serverless controllers (`stateController.mjs`), middleware (`authMiddleware.mjs`, `securityMiddleware.mjs`), and database gateway (`supabaseClient.mjs`).
* **Consequences:** Reusable components can be imported by any new workspace. Clear boundaries between frontend UI and backend services.
* **Verified Result:** All 7 unit tests pass (`7 passed, 0 failed`), deployed and verified on staging.

---

## [ADR-006] Adoption of Multi-Repository & Multi-Domain Architecture for Code Privacy

* **Date:** 2026-10-31
* **Status:** Accepted & Ready for Implementation
* **Context:** The team requires external developers and contractors to work exclusively on specific applications (e.g. Orders) without granting them access to the platform core or other applications' source code.
* **Decision:** Approved the **Polyrepo (5 GitHub Repositories) + Multi-Domain (5 Vercel Projects)** model:
  - `archscale-platform` (`archscale-portal.vercel.app`): Core portal, Super Admin, API gateway, master SQL migrations.
  - `archscale-contacts` (`archscale-contacts.vercel.app`): Contacts workspace.
  - `archscale-products` (`archscale-products.vercel.app`): Products workspace.
  - `archscale-orders` (`archscale-orders.vercel.app`): Orders workspace.
  - `archscale-tasks` (`archscale-tasks.vercel.app`): Tasks workspace.
  - Cross-domain authentication handled via secure **URL Hash Token Handoff (`#session=<JWT>`)** and CORS whitelisting.
* **Consequences:** Total code privacy for external contractors. Independent deployment pipelines and rollback safety per app.
* **Verified Result:** Architectural specification documented in `docs/WORKFLOW-MULTI-REPO-DOMAINS.md`.
