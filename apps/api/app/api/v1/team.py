from datetime import UTC, datetime, timedelta
from secrets import token_urlsafe

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import INVITABLE_BY_ROLE, MANAGE_ROLES, get_current_user, require_roles
from app.core.db import get_db
from app.core.security import create_access_token, hash_invite_token, hash_password
from app.models.branch import Branch
from app.models.invite import Invite
from app.models.user import User
from app.schemas.auth import (
    InviteAccept,
    InviteCreate,
    InviteCreated,
    InviteOut,
    MemberOut,
    TokenResponse,
    UserOut,
)

router = APIRouter(tags=["team"])


def _branch_for_tenant(db: Session, tenant_id: str, branch_id: str | None) -> Branch | None:
    if not branch_id:
        return None
    branch = db.scalar(select(Branch).where(Branch.id == branch_id, Branch.tenant_id == tenant_id))
    if branch is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Branch not found")
    return branch


@router.get("/team", response_model=list[MemberOut])
def list_team(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[User]:
    return list(
        db.scalars(
            select(User)
            .options(joinedload(User.branch))
            .where(User.tenant_id == user.tenant_id)
            .order_by(User.full_name)
        )
    )


@router.get("/invites", response_model=list[InviteOut])
def list_invites(
    user: User = Depends(require_roles(*MANAGE_ROLES)),
    db: Session = Depends(get_db),
) -> list[Invite]:
    return list(
        db.scalars(
            select(Invite)
            .options(joinedload(Invite.branch))
            .where(Invite.tenant_id == user.tenant_id, Invite.accepted_at.is_(None))
            .order_by(Invite.created_at.desc())
        )
    )


@router.post("/invites", response_model=InviteCreated, status_code=status.HTTP_201_CREATED)
def create_invite(
    body: InviteCreate,
    user: User = Depends(require_roles(*MANAGE_ROLES)),
    db: Session = Depends(get_db),
) -> InviteCreated:
    allowed = INVITABLE_BY_ROLE.get(user.role, ())
    if body.role not in allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You cannot invite that role")

    email = body.email.lower()
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    pending = db.scalar(
        select(Invite.id).where(
            Invite.tenant_id == user.tenant_id,
            Invite.email == email,
            Invite.accepted_at.is_(None),
        )
    )
    if pending:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Invite already pending for this email")

    branch = _branch_for_tenant(db, user.tenant_id, body.branch_id)
    raw_token = token_urlsafe(32)
    invite = Invite(
        tenant_id=user.tenant_id,
        branch_id=branch.id if branch else None,
        invited_by_user_id=user.id,
        email=email,
        role=body.role,
        token_hash=hash_invite_token(raw_token),
        expires_at=datetime.now(UTC) + timedelta(days=7),
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)
    invite.branch = branch
    return InviteCreated(
        invite=InviteOut.model_validate(invite),
        token=raw_token,
        join_path=f"/join?token={raw_token}",
    )


@router.post("/invites/accept", response_model=TokenResponse)
def accept_invite(body: InviteAccept, db: Session = Depends(get_db)) -> TokenResponse:
    invite = db.scalar(
        select(Invite)
        .options(joinedload(Invite.tenant), joinedload(Invite.branch))
        .where(Invite.token_hash == hash_invite_token(body.token))
    )
    if invite is None or invite.accepted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found")
    expires = invite.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=UTC)
    if expires < datetime.now(UTC):
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Invite has expired")
    if db.scalar(select(User.id).where(User.email == invite.email)):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    member = User(
        tenant_id=invite.tenant_id,
        branch_id=invite.branch_id,
        email=invite.email,
        password_hash=hash_password(body.password),
        full_name=body.full_name.strip(),
        role=invite.role,
    )
    invite.accepted_at = datetime.now(UTC)
    db.add(member)
    db.commit()
    db.refresh(member)
    member.tenant = invite.tenant
    member.branch = invite.branch
    return TokenResponse(
        access_token=create_access_token(user_id=member.id, tenant_id=member.tenant_id, role=member.role),
        user=UserOut.model_validate(member),
    )
