from fastapi import APIRouter

from app.api.v1.health import router as health_router

api_v1 = APIRouter()
api_v1.include_router(health_router, tags=["health"])
