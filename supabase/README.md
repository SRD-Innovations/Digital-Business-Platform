# Supabase

Postgres (and file storage) for the Digital Business Platform. **FastAPI remains the only business API** — the web app does not call PostgREST for domain operations.

## Layout

```text
supabase/
  migrations/   SQL migrations, applied in order
```

Create the hosted project in the Supabase dashboard (region closest to Sri Lanka, typically Mumbai / South Asia). Put URL and keys in Railway (API, including service role) and Vercel (anon key + URL only).

Local CLI (`supabase start`) can wait until `feature/core-auth-tenancy` needs a schema. Do not invent tables on this branch.
