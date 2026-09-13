from fastapi import APIRouter

from app.core.config import settings

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    database = "configured" if settings.database_url else "not_configured"
    return {
        "status": "ok",
        "service": "dbp-api",
        "env": settings.api_env,
        "database": database,
    }
