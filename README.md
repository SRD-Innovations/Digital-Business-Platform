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

The product spec lives in [`mvp.md`](./mvp.md). How we will ship it is in [`docs/mvp-build-plan.md`](./docs/mvp-build-plan.md).

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

Details: [`docs/stack.md`](./docs/stack.md) · [`docs/architecture.md`](./docs/architecture.md) · [`docs/deployment.md`](./docs/deployment.md)

## Repository layout

```text
apps/web       Next.js POS + back-office (Vercel)
apps/api       FastAPI REST API (Railway)
supabase/      schema, migrations, local config
docs/          architecture, git workflow, deployment, MVP plan
.github/       CI and pull request template
```

## How this repo is organised

- **`main`** — stable / release line
- **`develop`** — default working branch (integration)
- **`feature/*`** — one MVP slice at a time, merged into `develop`

See [`docs/git-workflow.md`](./docs/git-workflow.md) and [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Local development

Prerequisites: [Bun](https://bun.sh), Python 3.12+, [Supabase CLI](https://supabase.com/docs/guides/cli) (when the database work starts).

```bash
# Web
cd apps/web
bun install
bun run dev

# API
cd apps/api
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
```

Copy [`.env.example`](./.env.example) to `.env` files as needed. Never commit secrets.

API docs (once the API is running): [http://127.0.0.1:8000/v1/docs](http://127.0.0.1:8000/v1/docs)

## Product vision (short)

A single role-based web platform, built around a POS-driven core, with **module families** instead of a separate product per industry. MVP ships **Trade** and **Manufacturing**. Hospitality and Services follow in later phases.

Business model: SaaS subscription — 2–3 week trial, monthly or yearly billing, tiers by branches / users / enabled module families.

---

Built by [SRD Innovations](https://github.com/SRD-Innovations).
