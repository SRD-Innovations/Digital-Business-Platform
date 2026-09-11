# Architecture

The Digital Business Platform is one **multi-tenant web application** with a POS-driven core and **module families** layered on top. It is not a POS with extras bolted on, and it is not a separate codebase per industry.

## Shape

```text
┌─────────────────────────────────────────────────────────┐
│  Next.js (apps/web) — Bun                               │
│  POS screen + back-office, PWA / service worker later   │
│  IndexedDB / PGlite for offline (phase 4)               │
└──────────────────────────┬──────────────────────────────┘
                           │ REST /v1
┌──────────────────────────▼──────────────────────────────┐
│  FastAPI (apps/api) — only API surface                  │
│  Auth/RBAC, tenants, branches, POS, ERP, modules        │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  Supabase Postgres + storage                            │
│  FastAPI owns business logic; Supabase is data, not API │
└─────────────────────────────────────────────────────────┘

Host: web → Vercel    API → Railway    CI → GitHub Actions
```

## Design rules taken from the MVP spec

- **Position wide, build narrow.** Market the platform as fit for many business types. Build only **Trade** and **Manufacturing** in MVP, plus a Solo tier that is core-only.
- **Modular core + families.** Shared operations (stock, money, people, branches) live in core. Family modules add pricing tiers, pharmacy batch/expiry, BOM, yield — they do not fork the product.
- **Offline-first is a differentiator.** Connectivity and power cuts are routine. The first POS build is online-first so the domain model exists; the sync queue is the highest-risk follow-on and must not be treated as polish.
- **FastAPI is the only API.** Supabase Auth/Storage may save time, but clients do not talk to PostgREST for business operations. That keeps RBAC, tenancy, and later analytics in one place.
- **Web only for MVP.** Flutter and Electron are shelved, not discarded. Hardware (barcode, thermal print) targets Chromium via WebUSB / WebHID / WebBluetooth.

## Multi-tenancy (open decision)

`mvp.md` still needs a call: shared database with `tenant_id` vs schema-per-tenant. Until that is decided, new tables should assume a `tenant_id` column and never leak cross-tenant reads in API queries. Revisit before the auth/tenancy feature branch lands.

## Roles (core)

Owner/Admin · Manager · Cashier · Stock Keeper · Accountant · Production Staff, plus custom roles with per-module permissions. Multi-branch: stock and staff are per branch.

## Module families

| Family | MVP? | What it adds on the core |
| --- | --- | --- |
| Trade | Yes | High-SKU catalog, supplier price lists, wholesale tiers, pharmacy batch/expiry and prescription records |
| Manufacturing | Yes | BOM, raw → finished goods, yield/wastage, batch costing |
| Solo | Yes (core only) | No extra module |
| Hospitality | No | Table/room booking — Phase 2 |
| Services | No | Appointment/job billing — Phase 2/3 |

## Offline (phase 4, not this branch)

Local store: IndexedDB via Dexie.js or PGlite. Sync: device operation log (timestamp + device/user id) posted to FastAPI. Last-write-wins or field-level resolve with a log for ambiguous cases. Schema should allow a later move to PowerSync / ElectricSQL without a rewrite.

## What this branch is not

No auth, POS, or schema yet. This is the skeleton so feature branches can add one MVP slice at a time. See [`mvp-build-plan.md`](./mvp-build-plan.md).
