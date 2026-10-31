# ArchScale Multi-Repo & Multi-Domain Architecture Workflow

**Status:** Approved Architectural Blueprint  
**Target Architecture:** Polyrepo (5 Independent Repositories) + Multi-Domain Vercel Deployments + Central Hosted Supabase Database  
**Author:** ArchScale Engineering Team  
**Last Updated:** October 2026

---

## 1. Executive Summary & Objective

This document defines the complete technical workflow, repository topology, deployment architecture, and security boundaries for transitioning ArchScale from a single-repository pilot into a **Multi-Repository, Multi-Domain System**.

### Primary Business & Engineering Objectives:
1. **Developer Code Isolation**: External developers and contractors assigned to a specific app (e.g. Orders) must only have access to that app's repository. They cannot view, clone, or tamper with the platform core or other applications' source code.
2. **Independent Deployments & Domains**: Each application runs on its own isolated Vercel project and public domain (`archscale-contacts.vercel.app`, `archscale-orders.vercel.app`, etc.) with independent build pipelines and rollback capabilities.
3. **Unified Identity & Database Governance**: All apps connect to a single central Supabase PostgreSQL staging/production database with strict Row-Level Security (RLS) and schema isolation (`contacts`, `products`, `orders`, `tasks`, `public`).
4. **Seamless Cross-Domain Single Sign-On (SSO)**: Users sign in once at the main portal and navigate between application domains without password re-prompts or broken sessions.

---

## 2. Multi-Repository Topology

The codebase will be split into **5 distinct GitHub repositories**:

```text
GitHub Organization / Account (Ritikkeshari07)
│
├── 1. archscale-platform (PRIVATE - Core Team Only)
│   ├── Platform Portal Web UI (Dashboard & App Launcher)
│   ├── Super Admin Management Panel (/admin)
│   ├── API Gateway & Serverless Router (/api/*)
│   ├── Master Database Blueprints (supabase/migrations/)
│   └── Reusable UI Component Library (@archscale/ui)
│
├── 2. archscale-contacts (Assigned Contacts Team)
│   ├── Contacts Workspace UI
│   ├── Contacts Domain Validation & Model Logic
│   └── Local Dev Mock Server / Test Suite
│
├── 3. archscale-products (Assigned Products Team)
│   ├── Products Catalog & SKU Workspace UI
│   └── Product Domain Logic & Pricing Calculations
│
├── 4. archscale-orders (Assigned Orders Team)
│   ├── Orders Creation & Line-Item Workspace UI
│   └── Order Calculation & Linkage Logic
│
└── 5. archscale-tasks (Assigned Tasks Team)
    ├── Tasks Follow-up & Coordination Workspace UI
    └── Task Assignment & Due-Date Domain Logic
```

---

## 3. Independent Domain & Deployment Architecture

Each repository connects to its own independent Vercel project on the Vercel Hobby plan:

```mermaid
flowchart TD
    subgraph Repos["Independent GitHub Repositories"]
        R1[archscale-platform]
        R2[archscale-contacts]
        R3[archscale-products]
        R4[archscale-orders]
        R5[archscale-tasks]
    end

    subgraph VercelProjects["Dedicated Vercel Projects & Domains"]
        D1["archscale-portal.vercel.app<br/>(Main Portal & Super Admin)"]
        D2["archscale-contacts.vercel.app<br/>(Contacts App)"]
        D3["archscale-products.vercel.app<br/>(Products App)"]
        D4["archscale-orders.vercel.app<br/>(Orders App)"]
        D5["archscale-tasks.vercel.app<br/>(Tasks App)"]
    end

    subgraph Database["Central Supabase PostgreSQL (ap-south-1 Mumbai)"]
        DB[(djechswitjpwajqtwfig)]
        DB --- S_Pub[public schema: tenancy, auth, audit, contracts]
        DB --- S_Con[contacts schema]
        DB --- S_Pro[products schema]
        DB --- S_Ord[orders schema]
        DB --- S_Tas[tasks schema]
    end

    R1 -->|Auto Deploy| D1
    R2 -->|Auto Deploy| D2
    R3 -->|Auto Deploy| D3
    R4 -->|Auto Deploy| D4
    R5 -->|Auto Deploy| D5

    D1 -->|PostgREST & RPC| DB
    D2 -->|PostgREST & RPC| DB
    D3 -->|PostgREST & RPC| DB
    D4 -->|PostgREST & RPC| DB
    D5 -->|PostgREST & RPC| DB
```

---

## 4. Cross-Domain Single Sign-On (SSO) Protocol

Because browsers treat distinct `*.vercel.app` subdomains as separate origins, authentication cookies cannot be shared directly. We implement a secure **URL Hash Token Handoff Protocol**:

```mermaid
sequenceDiagram
    autonumber
    actor User as User Browser
    participant Portal as archscale-portal.vercel.app
    participant Orders as archscale-orders.vercel.app
    participant DB as Supabase PostgreSQL

    User->>Portal: Signs in (Email & Password)
    Portal->>DB: POST /auth/v1/token?grant_type=password
    DB-->>Portal: Returns JWT Access Token
    Portal->>Portal: Stores JWT in portal localStorage

    Note over User,Portal: User clicks "Open Orders →"
    Portal->>Orders: Redirects to: https://archscale-orders.vercel.app/#session=<JWT>

    Note over User,Orders: Orders App Ingestion
    Orders->>Orders: Extracts JWT from window.location.hash
    Orders->>Orders: Stores JWT in Orders localStorage
    Orders->>Orders: Calls history.replaceState() to scrub token from address bar
    Orders->>DB: Queries orders.orders with Authorization: Bearer <JWT>
    DB-->>Orders: 200 OK (Row-Level Security verified)
    Orders-->>User: Displays Orders workspace seamlessly logged in
```

### Security Considerations:
* **Token Exposure Prevention**: The session token is transmitted in the URL **hash fragment (`#session=...`)**, not in query parameters (`?session=...`). Hash fragments are **never sent to web servers** in HTTP headers and are not logged in CDN access logs.
* **Immediate Cleanup**: As soon as `app.js` initializes on the destination app, it calls `history.replaceState(null, '', window.location.pathname)` so the token disappears from the browser history.

---

## 5. CORS & API Security Configuration

The API gateway in `archscale-platform` enforces an allowed origins whitelist:

```javascript
const ALLOWED_ORIGINS = [
  'https://archscale-portal.vercel.app',
  'https://archscale-contacts.vercel.app',
  'https://archscale-products.vercel.app',
  'https://archscale-orders.vercel.app',
  'https://archscale-tasks.vercel.app'
];

export function handleCors(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin) || !origin) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
}
```

---

## 6. Database Blueprint & Migration Governance

### Centralized Migration Master:
* All database migrations live strictly inside **`archscale-platform/supabase/migrations/`**.
* The Supabase CLI and deployment keys are managed exclusively by the platform team.
* **Contractor / App Developer Workflow**:
  - Developers working on `archscale-orders` receive a local staging environment variable set containing only:
    - `SUPABASE_URL`
    - `SUPABASE_PUBLISHABLE_KEY` (Anon key)
    - Test credentials restricted by Row-Level Security (RLS) to `'orders'`.
  - Developers **never receive the `service_role` master key**.
  - If the Orders app requires a new database column, the developer creates a pull request against `archscale-platform` with their SQL migration (e.g. `20261105_orders_add_discount.sql`), which is reviewed and pushed by the platform owner.

---

## 7. Migration Execution Status

1. **Phase 1: UI Upgrade & JIT Recovery Vault (Completed)**
   - Unified authentication modal with "Create Account" transition.
   - Dynamic form input fallbacks (select dropdown when online, text input when removed).
   - Clean relationship table cells with tooltips.
   - Database schema blueprints (`public.schema_blueprints`) and permanent backup vault (`public.data_snapshots`).
   - JIT developer recovery tickets with auto-hidden Super Admin approval queue.
2. **Phase 2: Polyrepo Generation & Standalone Mock Contracts (Completed)**
   - Automated generator `scripts/generate-polyrepos.mjs` implemented.
   - All 5 repositories generated under `../repos/` with isolated `.git` histories:
     - `archscale-platform`
     - `archscale-contacts`
     - `archscale-products`
     - `archscale-orders`
     - `archscale-tasks`
   - Standalone offline servers and unit test suites verified (100% pass).
3. **Phase 3: Production Deployment to Vercel Domains (Next Step)**
   - Deploy each independent repo to its dedicated Vercel project with custom domain mapping.

---

## 8. Standalone Repositories Inventory & Local Developer Runbook

Each generated repository inside `../repos/` is 100% self-contained and allows offline development:

| Repository Name | Assigned Scope | Port | Local Run Command | Unit Test Command | Target Vercel Domain |
|---|---|---|---|---|---|
| `archscale-platform` | Core Platform & Super Admin | 3000 | `npm start` | `npm test` | `archscale-four-apps-staging.vercel.app` |
| `archscale-contacts` | Contacts & Directory | 3001 | `npm run dev` | `npm test` | `archscale-contacts.vercel.app` |
| `archscale-products` | Products & Pricing | 3002 | `npm run dev` | `npm test` | `archscale-products.vercel.app` |
| `archscale-orders` | Orders & Calculations | 3003 | `npm run dev` | `npm test` | `archscale-orders.vercel.app` |
| `archscale-tasks` | Tasks & Operations | 3004 | `npm run dev` | `npm test` | `archscale-tasks.vercel.app` |

### Contractor Offline Workflow:
1. Clone assigned repository (e.g. `git clone https://github.com/Ritikkeshari07/archscale-orders.git`).
2. Run `npm run dev`. The server starts at `http://127.0.0.1:3003` serving mock contracts from `src/mocks/state.json`.
3. Develop frontend features, form validations, and calculations locally.
4. Run `npm test` to verify contracts.
5. Push to GitHub to trigger Vercel preview/production deployment.

---

## 9. Vercel Multi-Domain Setup & Linking Guide

For each repository in `../repos/`:
1. **Push to GitHub**:
   ```bash
   cd ../repos/<repo-name>
   git remote add origin https://github.com/Ritikkeshari07/<repo-name>.git
   git branch -M main
   git push -u origin main
   ```
2. **Link in Vercel**:
   - Create a new project in the Vercel dashboard imported from `Ritikkeshari07/<repo-name>`.
   - Root directory: `./`
   - Framework preset: `Other`
   - Rewrites and security headers are automatically parsed from `vercel.json`.
3. **Configure Environment Variables (Production & Preview)**:
   - For `archscale-platform`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `SESSION_SECRET`.
   - For `archscale-contacts`, `archscale-products`, `archscale-orders`, `archscale-tasks`: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (or proxy via Platform API gateway).


