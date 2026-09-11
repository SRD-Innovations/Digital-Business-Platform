# Digital Business Platform — API

FastAPI REST API (`/v1`). Hosted on **Railway**. OpenAPI: `/v1/docs`.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
pytest
```

Supabase is the database. This service is the only business API — do not expose PostgREST to the web app.
