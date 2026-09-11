# Digital Business Platform

Sri Lanka’s first-target product from **SRD Innovations**: a web-based **business management platform** (EPOS + ERP), not a POS tool with extras bolted on.

It is a SaaS operating system for a business — roles, branches, stock, sales, purchasing, and production — designed so a rice mill, a pharmacy, and a neighbourhood shop can share one modular core.

**Status:** early MVP. Web only. Offline-first is a product requirement, not a later add-on.

## Who it is for

Price-sensitive Sri Lankan operators who today run on a notebook and a calculator: retail, wholesale, pharmacy, mills, garment and general production, and self-employed / solo traders.

Common constraints that drive the design:

- Unreliable connectivity and power cuts — the app must keep working offline
- Sinhala, Tamil, and English are all first-class
- Daily operators are often not tech-trained — onboarding must stay near zero-training
- Trust and reliability beat a long feature list

## What the MVP includes

| Area | In MVP |
| --- | --- |
| Core platform | Auth, roles, multi-branch, localisation (LKR, tax formats) |
| POS | Fast checkout, split payments, shifts, receipts |
| ERP core | Inventory, purchasing, basic accounting, reporting |
| Trade family | Retail / wholesale / pharmacy (barcode, batches, pricing tiers) |
| Manufacturing family | BOM, raw → finished goods, yield/wastage, batch costing |
| Solo tier | Core platform only — no extra module build |

**Out of MVP:** native mobile/desktop, hospitality (restaurants/hotels), services (salons/repair), marketplace, payment-processing revenue share.

The product spec lives in [`mvp.md`](./mvp.md).

## Stack (current)

| Layer | Choice |
| --- | --- |
| Web app | Next.js (TypeScript, App Router) |
| Runtime / package manager | Bun |
| API | FastAPI (Python), versioned REST `/v1` |
| Database & storage | Supabase (Postgres) |
| Web hosting | Vercel |
| API hosting | Railway |
| CI | GitHub Actions |

## How this repo is organised

- **`main`** — stable / release line
- **`develop`** — default working branch (integration)
- **`feature/*`** — one MVP slice at a time, merged into `develop`

The product spec is [`mvp.md`](./mvp.md). Application code will live in a monorepo (`apps/web`, `apps/api`, `supabase/`) as that structure is added.

## Product vision (short)

A single role-based web platform, built around a POS-driven core, with **module families** instead of a separate product per industry. MVP ships **Trade** and **Manufacturing**. Hospitality and Services follow in later phases.

Business model: SaaS subscription — 2–3 week trial, monthly or yearly billing, tiers by branches / users / enabled module families.

---

Built by [SRD Innovations](https://github.com/SRD-Innovations).
