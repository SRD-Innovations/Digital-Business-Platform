from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import MANAGE_ROLES, get_current_user, require_roles
from app.core.db import get_db
from app.models.branch import Branch
from app.models.user import User
from app.schemas.auth import BranchCreate, BranchOut
from app.services.billing import assert_can_add_branch

router = APIRouter(prefix="/branches", tags=["branches"])


@router.get("", response_model=list[BranchOut])
def list_branches(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Branch]:
    return list(db.scalars(select(Branch).where(Branch.tenant_id == user.tenant_id).order_by(Branch.name)))


@router.post("", response_model=BranchOut, status_code=status.HTTP_201_CREATED)
def create_branch(
    body: BranchCreate,
    user: User = Depends(require_roles(*MANAGE_ROLES)),
    db: Session = Depends(get_db),
) -> Branch:
    assert_can_add_branch(db, user.tenant_id)
    name = body.name.strip()
    existing = db.scalar(
        select(Branch.id).where(Branch.tenant_id == user.tenant_id, Branch.name == name)
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A branch with that name exists")
    branch = Branch(tenant_id=user.tenant_id, name=name)
    db.add(branch)
    db.commit()
    db.refresh(branch)
    return branch
