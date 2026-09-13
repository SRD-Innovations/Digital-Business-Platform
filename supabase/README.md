# Supabase

Postgres (and file storage) for the Digital Business Platform. **FastAPI remains the only business API** — the web app does not call PostgREST for domain operations.

## Layout

```text
supabase/
  migrations/   SQL migrations, applied in order
```

Project ref: `fqbxexfiqihtmdfultth`  
Hosted URL: https://fqbxexfiqihtmdfultth.supabase.co

Local CLI is optional. `docker compose up` from the repo root starts Postgres and applies `supabase/migrations/` on first boot.
