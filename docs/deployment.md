# Deployment

| Surface | Host | URL |
| --- | --- | --- |
| `apps/web` | Vercel | https://srd-biz.vercel.app |
| `apps/api` | Render | https://digital-business-platform.onrender.com |
| Database | Supabase | `fqbxexfiqihtmdfultth` (Mumbai / South Asia when available) |
| CI | GitHub Actions | `.github/workflows/ci.yml` |

Never commit database passwords or service-role keys. Put them only in Vercel / Render / local `.env` files.

## Vercel (web)

Live: [srd-biz.vercel.app](https://srd-biz.vercel.app)

Root directory `apps/web`. Install `bun install`. Build `bun run build`.

Set these **Production** environment variables, then Redeploy:

| Key | Value |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | `https://digital-business-platform.onrender.com` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://fqbxexfiqihtmdfultth.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the `sb_publishable_…` key from Supabase (Settings → API) |

`NEXT_*` values are baked in at **build** time. Changing them requires a new Vercel deploy.

## Render (API)

Live: [digital-business-platform.onrender.com](https://digital-business-platform.onrender.com)

| Field | Value |
| --- | --- |
| Root Directory | `apps/api` |
| Build | `pip install -e .` |
| Start | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Health | `/v1/health` |
| Region | Singapore |

Environment variables:

| Key | Value |
| --- | --- |
| `PYTHON_VERSION` | `3.12.8` |
| `API_ENV` | `production` |
| `API_CORS_ORIGINS` | `https://srd-biz.vercel.app,http://localhost:3000` |
| `SUPABASE_URL` | `https://fqbxexfiqihtmdfultth.supabase.co` |
| `DATABASE_URL` | Postgres URI from Supabase. **URL-encode** `#` and `@` in the password (`#` → `%23`, `@` → `%40`) |

If Render cannot reach the database (IPv6), use Supabase **Session pooler** (port 6543) instead of the direct `db.*:5432` host.

Do not put `SUPABASE_SERVICE_ROLE_KEY` or `DATABASE_URL` in the Next.js / Vercel project.

Check:

- https://digital-business-platform.onrender.com/v1/health
- https://digital-business-platform.onrender.com/v1/docs

Free Render sleeps when idle; the first request can take ~1 minute.

## Supabase

Project ref: `fqbxexfiqihtmdfultth`  
URL: https://fqbxexfiqihtmdfultth.supabase.co

```bash
supabase login
supabase link --project-ref fqbxexfiqihtmdfultth
```

Run `supabase init` only once in this repo (keep files under `supabase/`). Schema starts on `feature/core-auth-tenancy`.

## GitHub Actions

On pull requests and pushes to `develop` / `main`:

- Web: `bun install`, lint, typecheck, build
- API: install `apps/api` extras, `pytest`

## Staging vs production

- **`develop`** → Vercel production branch (current) and Render auto-deploy
- **`main`** → reserve for a later production cut if you split staging

## Later

AWS `ap-south-1` (Mumbai) or a Sri Lankan host, Cloudflare in front of the API, when latency for real tenants requires it.
