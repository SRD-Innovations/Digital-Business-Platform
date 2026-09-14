from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user, slugify, unique_slug
from app.core.config import settings
from app.core.db import get_db
from app.core.phone import looks_like_phone, normalize_lk_phone
from app.core.security import create_access_token, hash_password, verify_password
from app.models.branch import Branch
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserOut
from app.services.billing import start_trial_subscription

router = APIRouter(prefix="/auth", tags=["auth"])


def _token_for(user: User) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(user_id=user.id, tenant_id=user.tenant_id, role=user.role),
        user=UserOut.model_validate(user),
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, db: Session = Depends(get_db)) -> TokenResponse:
    email = body.email.lower()
    existing = db.scalar(select(User).where(User.email == email))
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    slug = slugify(body.business_name)
    if db.scalar(select(Tenant.id).where(Tenant.slug == slug)):
        slug = unique_slug(slug)

    tenant = Tenant(name=body.business_name.strip(), slug=slug)
    db.add(tenant)
    db.flush()

    start_trial_subscription(db, tenant.id)

    branch = Branch(tenant_id=tenant.id, name="Main")
    db.add(branch)
    db.flush()

    user = User(
        tenant_id=tenant.id,
        branch_id=branch.id,
        email=email,
        password_hash=hash_password(body.password),
        full_name=body.full_name.strip(),
        role="owner",
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered") from None
    db.refresh(user)
    user.tenant = tenant
    user.branch = branch
    return _token_for(user)


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    identifier = (body.identifier or "").strip()
    query = select(User).options(joinedload(User.tenant), joinedload(User.branch))
    if looks_like_phone(identifier):
        user = db.scalar(query.where(User.phone == normalize_lk_phone(identifier)))
    else:
        user = db.scalar(query.where(User.email == identifier.lower()))
    if (
        user is None
        or not user.is_active
        or not user.password_hash
        or not verify_password(body.password, user.password_hash)
    ):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid login or password")
    if user.email and user.email.lower() in settings.platform_admin_email_set and not user.is_platform_admin:
        user.is_platform_admin = True
        db.commit()
        db.refresh(user)
    return _token_for(user)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> User:
    return user
