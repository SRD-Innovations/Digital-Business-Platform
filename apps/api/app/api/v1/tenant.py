from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import MANAGE_ROLES, get_current_user, require_roles
from app.core.db import get_db
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.auth import TenantOut, TenantUpdate

router = APIRouter(prefix="/tenant", tags=["tenant"])


@router.get("", response_model=TenantOut)
def get_tenant(user: User = Depends(get_current_user)) -> Tenant:
    return user.tenant


@router.patch("", response_model=TenantOut)
def update_tenant(
    body: TenantUpdate,
    user: User = Depends(require_roles(*MANAGE_ROLES)),
    db: Session = Depends(get_db),
) -> Tenant:
    tenant = user.tenant
    data = body.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        data["name"] = data["name"].strip()
    for key, value in data.items():
        if isinstance(value, str):
            value = value.strip() or None
        setattr(tenant, key, value)
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return tenant
