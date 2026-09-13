# Deployment

| Surface | Host | Source |
| --- | --- | --- |
| `apps/web` | **GitHub Pages** (current) | Push to `develop` → `.github/workflows/github-pages.yml` |
| `apps/api` | Railway | Same branches |
| Database | Supabase (hosted project) | Migrations in `supabase/migrations` |
| CI | GitHub Actions | `.github/workflows/ci.yml` |

GitHub Pages can only serve a **static** export of Next.js. That is enough for the current landing page. It will not host POS, auth cookies, or server-rendered routes later — move web to **Vercel Pro** (or similar) when those land. Hobby Vercel cannot import this GitHub **organization** repo.

## GitHub Pages (web)

Site URL after the first successful workflow:

`https://srd-innovations.github.io/Digital-Business-Platform/`

### One-time GitHub settings

1. Repo **Settings → Pages**
2. **Source:** GitHub Actions (not “Deploy from a branch”)
3. Merge this workflow to `develop` (or run **Actions → GitHub Pages → Run workflow**)
4. Wait for the **GitHub Pages** workflow to go green

The workflow builds `apps/web` with Bun (`bun install` / `bun run build`) and a `basePath` of `/Digital-Business-Platform` so assets load under the project URL.

Local preview of the static export:

```bash
cd apps/web
bun install
bun run build
bunx serve out
```

### Vercel (later)

When the team is on **Vercel Pro**, import the same GitHub repo:

1. Root directory: `apps/web`
2. Install: `bun install`
3. Build: `bun run build`
4. Then remove `output: "export"` if you need a real Next.js server
5. Env: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

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

CI is the gate before merge. GitHub Pages deploys `apps/web` from `develop`.

## Staging vs production

Until environments are named in each dashboard:

- **`develop`** → GitHub Pages (current public site) and API staging
- **`main`** → production when you promote a release

## Later (not required to start MVP)

AWS `ap-south-1` (Mumbai) or a Sri Lankan host, Cloudflare in front of the API, for latency once the product has real tenants. Record that move in this file when it happens.
