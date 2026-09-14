# MVP build plan

Source of truth for *what* to build: [`../mvp.md`](../mvp.md). This file is the *order* of feature branches. Do not start Phase 2+ work while an earlier phase is still open.

## Focus

Build the MVP only: core + POS + ERP core + Trade + Manufacturing + Solo (core-only). Offline-first is in scope but sequenced after an online POS so the domain exists before the sync queue.

## Feature branch sequence

Work from `develop`. One branch at a time unless two people are clearly not touching the same surface.

| Order | Branch (suggested) | Phase from `mvp.md` | Outcome |
| --- | --- | --- | --- |
| 0 | `docs/initial-structure` | Foundation (repo) | This documentation and empty app skeletons |
| 1 | `feature/foundation-ci-envs` | Foundation | Wired Vercel / Railway / Supabase projects, secrets in dashboards, green CI |
| 2 | `feature/core-auth-tenancy` | Core platform | Tenants, JWT, RBAC, branches, invites. Shared DB + `tenant_id` |
| 3 | `feature/pos-online` | POS (online-first) | Checkout, split payments, discounts, returns, shift/cash reconciliation |
| 4 | `feature/offline-sync` | Offline-first | IndexedDB/PGlite, service worker, sync queue, conflict log, last-synced UI. Protect this timeline |
| 5 | `feature/erp-core` | ERP core | Inventory, purchasing, basic accounting, reporting |
| 6 | `feature/module-trade` | Trade family | High-SKU, price lists, wholesale tiers, pharmacy batch/expiry |
| 7 | `feature/module-manufacturing` | Manufacturing family | BOM, conversion, yield/wastage, batch costing |
| 8 | `feature/billing` | Subscription layer | Trial, plans, PayHere (and peers), super-admin |
| 9 | `feature/localisation-pilot` | Localisation, QA, pilot | Sinhala/Tamil, IRD formats, hardware, one Trade + one Manufacturing pilot |

Split a row if the PR would be too large (e.g. `feature/pos-checkout` then `feature/pos-shifts`). Do not skip ahead to Hospitality, Services, marketplace, Flutter, or Electron.

## Open decisions to close on the matching branch

- Subscription pricing — `feature/billing`
- Bundled vs add-on Trade/Manufacturing — `feature/billing`
- Trial card-upfront or not — `feature/billing`
- Sync conflict rules — `feature/offline-sync`
- Shared DB vs schema-per-tenant — **closed: shared DB + `tenant_id`** (`feature/core-auth-tenancy`)

## Next concrete slice

`feature/module-manufacturing` first cut: BOM, production runs (consume components / produce finished goods), yield & wastage %, and simple batch unit cost from component list prices. Next after this branch: `feature/billing`.
