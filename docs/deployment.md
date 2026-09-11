# Deployment

| Surface | Host | Source |
| --- | --- | --- |
| `apps/web` | Vercel | GitHub `develop` (previews) and `main` (production) |
| `apps/api` | Railway | Same branches |
| Database | Supabase (hosted project) | Migrations in `supabase/migrations` |
| CI | GitHub Actions | `.github/workflows/ci.yml` |

## Vercel (web)

1. New Vercel project from this GitHub repo.
2. **Root directory:** `apps/web`
3. **Install:** `bun install`
4. **Build:** `bun run build`
5. Framework: Next.js
6. Env: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Preview deployments should follow pull requests into `develop`.

## Railway (API)

1. New Railway service from this GitHub repo.
2. **Root directory:** `apps/api`
3. Start command (also in `apps/api/railway.toml`):  
   `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Health check: `GET /v1/health`
5. Env: `API_ENV`, `API_CORS_ORIGINS`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

Do not put the Supabase service role key in the Next.js app.

## GitHub Actions

On pull requests and pushes to `develop` / `main`:

- Web: `bun install`, lint, typecheck, build
- API: install `apps/api` extras, `pytest`

Vercel and Railway own the deploy; CI is the gate before merge.

## Staging vs production

Until environments are named in each dashboard:

- **`develop`** → staging
- **`main`** → production

## Later (not required to start MVP)

AWS `ap-south-1` (Mumbai) or a Sri Lankan host, Cloudflare in front of the API, for latency once the product has real tenants. Record that move in this file when it happens.
