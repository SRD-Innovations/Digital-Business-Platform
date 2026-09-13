from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.branch import Branch
from app.models.user import User
from app.schemas.auth import BranchOut

router = APIRouter(prefix="/branches", tags=["branches"])


@router.get("", response_model=list[BranchOut])
def list_branches(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Branch]:
    return list(db.scalars(select(Branch).where(Branch.tenant_id == user.tenant_id).order_by(Branch.name)))
