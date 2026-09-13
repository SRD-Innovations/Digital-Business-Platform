# Supabase

Postgres (and file storage) for the Digital Business Platform. **FastAPI remains the only business API** — the web app does not call PostgREST for domain operations.

## Layout

```text
supabase/
  migrations/   SQL migrations, applied in order
```

Project ref: `fqbxexfiqihtmdfultth`  
Hosted URL: https://fqbxexfiqihtmdfultth.supabase.co

Local CLI (`supabase start`) can wait until `feature/core-auth-tenancy` needs a schema. Do not invent tables on this branch.
