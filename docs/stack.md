# Stack

Chosen for the MVP build. The original spec also listed AWS + Cloudflare; those remain a later production option, not the scaffolding path.

| Layer | Choice | Role |
| --- | --- | --- |
| Web | **Next.js** (TypeScript, App Router) | POS + back-office in one web app |
| JS runtime / packages | **Bun** | Install, scripts, CI for `apps/web` |
| API | **FastAPI** (Python) | Only business API. REST, versioned `/v1`, OpenAPI |
| Data | **Supabase** (Postgres + storage) | Relational inventory/ledgers; FastAPI still owns the API |
| Web host | **Vercel** | Next.js at [srd-biz.vercel.app](https://srd-biz.vercel.app) |
| API host | **Render** | FastAPI at [digital-business-platform.onrender.com](https://digital-business-platform.onrender.com) |
| CI | **GitHub Actions** | Lint/test/build on PRs to `develop` and `main` |

## Why these, for now

- **FastAPI** — API-first, generated docs, room for later analytics/forecasting in Python.
- **Next.js + TypeScript** — one web codebase for cashier UI and admin.
- **Bun** — faster local and CI loops than npm for this app.
- **Supabase** — Postgres fits stock, ledgers, and branches; storage and optional Auth cut early work. Clients still call FastAPI, not PostgREST, for domain operations.
- **Vercel + Render + Supabase** — web on Vercel, API on Render, Postgres on Supabase. Hobby Vercel cannot import GitHub **org** repos; this project’s Vercel app is connected and live. Lowest-latency AWS `ap-south-1` stays a later option.

## API style

REST, versioned (`/v1/...`), documented at `/v1/docs` (Swagger) and `/v1/openapi.json`.

## Explicitly not in this pass

- Native mobile (Flutter) or desktop (Electron)
- Hospitality / Services families
- Managed sync (PowerSync, ElectricSQL) — hand-rolled queue first, schema kept portable
