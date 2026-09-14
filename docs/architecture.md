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

Host: web → Vercel    API → Render    data → Supabase    CI → GitHub Actions
```

## Design rules taken from the MVP spec

- **Position wide, build narrow.** Market the platform as fit for many business types. Build only **Trade** and **Manufacturing** in MVP, plus a Solo tier that is core-only.
- **Modular core + families.** Shared operations (stock, money, people, branches) live in core. Family modules add pricing tiers, pharmacy batch/expiry, BOM, yield — they do not fork the product.
- **Offline-first is a differentiator.** Connectivity and power cuts are routine. The first POS build is online-first so the domain model exists; the sync queue is the highest-risk follow-on and must not be treated as polish.
- **FastAPI is the only API.** Supabase Auth/Storage may save time, but clients do not talk to PostgREST for business operations. That keeps RBAC, tenancy, and later analytics in one place.
- **Web only for MVP.** Flutter and Electron are shelved, not discarded. Hardware (barcode, thermal print) targets Chromium via WebUSB / WebHID / WebBluetooth.

## Multi-tenancy

MVP uses a **shared database with `tenant_id`** on tenant-owned tables. Schema-per-tenant is more isolation than we need and slows every migration. Every API query that returns business data must filter by the JWT `tenant_id`.

## Identity (Sri Lanka-first)

- **Owners / business creation:** email + password is the default. Google, Facebook, and TikTok OAuth can also create the business (enter the business name first). Callback URLs are `{API}/v1/auth/oauth/{google|facebook|tiktok}/callback`.
- **Staff:** phone-first. Invite with a Sri Lankan mobile (`077…` stored as `+94…`). Email is optional. Join via password on the invite link, WhatsApp, or the same social providers.
- Login accepts **email or phone** plus password. Social-only users (no password) sign in through the provider they used.
- Unique contacts: email and phone are unique when present; several people may have neither if they only use OAuth.

## Row Level Security (RLS)

Postgres (and therefore Supabase) can enforce **row-level security**: extra `WHERE` clauses the database itself applies, based on the current role and session settings. It is not “raw” security — the name is **row** level security.

Without RLS, anyone who can query a table as `anon` / `authenticated` (the Supabase publishable key + Data API) sees **every tenant’s rows**. With RLS enabled and **no policies**, those roles see **nothing**. That is what the `enable_rls` migration does.

FastAPI currently connects as a privileged DB role (`postgres` / connection-string user). That role **bypasses RLS**. Isolation for the app is still FastAPI filtering on `tenant_id`. RLS is a second lock on the door so a leaked publishable key cannot dump the database through PostgREST.

Later we can add a non-bypass `dbp_app` role and policies like `tenant_id = current_setting('app.tenant_id')::uuid`, then set that setting per request. Not required to start local Docker.

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

## Offline (phase 4)

Local store: IndexedDB (hand-rolled stores for catalog + pending checkout ops; Dexie/PGlite remain options). Sync: device operation log (`client_op_id` + `device_id`) posted to FastAPI checkout; retries are idempotent. Last-write-wins for now; ambiguous cases can land in `sync_conflicts`. Production registers a thin app-shell service worker. Schema should allow a later move to PowerSync / ElectricSQL without a rewrite.

## What this branch is not

Custom per-module permissions, password reset, email delivery of invites, social OAuth app keys, field-level conflict UI, offline void/return/park/shift open, real thermal WebUSB printers, loyalty, and SMS receipts.
