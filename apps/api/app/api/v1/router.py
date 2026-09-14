from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.branches import router as branches_router
from app.api.v1.erp import router as erp_router
from app.api.v1.health import router as health_router
from app.api.v1.oauth import router as oauth_router
from app.api.v1.pos import router as pos_router
from app.api.v1.team import router as team_router

api_v1 = APIRouter()
api_v1.include_router(health_router, tags=["health"])
api_v1.include_router(auth_router)
api_v1.include_router(oauth_router)
api_v1.include_router(branches_router)
api_v1.include_router(team_router)
api_v1.include_router(pos_router)
api_v1.include_router(erp_router)
