from datetime import UTC, datetime, timedelta
from urllib.parse import urlencode

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from jwt import InvalidTokenError
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.core.db import get_db
from app.core.oauth import (
    PROVIDERS,
    authorization_url,
    configured_providers,
    fetch_profile,
)
from app.core.security import create_access_token, hash_invite_token
from app.models.branch import Branch
from app.models.invite import Invite
from app.models.oauth_account import OAuthAccount
from app.models.tenant import Tenant
from app.models.user import User
from app.api.deps import slugify, unique_slug

router = APIRouter(prefix="/auth/oauth", tags=["oauth"])


def _web_redirect(**params: str) -> RedirectResponse:
    return RedirectResponse(f"{settings.web_origin.rstrip('/')}/auth/oauth/callback?{urlencode(params)}")


def _encode_state(**payload: str) -> str:
    body = {key: value for key, value in payload.items() if value}
    body["exp"] = datetime.now(UTC) + timedelta(minutes=15)
    return jwt.encode(body, settings.jwt_secret, algorithm="HS256")


def _decode_state(state: str) -> dict[str, str]:
    try:
        data = jwt.decode(state, settings.jwt_secret, algorithms=["HS256"])
    except InvalidTokenError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid OAuth state") from exc
    return {key: str(value) for key, value in data.items() if key != "exp"}


def _issue_redirect(user: User) -> RedirectResponse:
    token = create_access_token(user_id=user.id, tenant_id=user.tenant_id, role=user.role)
    return _web_redirect(access_token=token)


@router.get("/providers")
def providers() -> dict[str, bool]:
    return configured_providers()


@router.get("/{provider}/start")
def start_oauth(
    provider: str,
    intent: str = "login",
    invite_token: str = "",
    business_name: str = "",
) -> RedirectResponse:
    if provider not in PROVIDERS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown provider")
    if not configured_providers()[provider]:
        return _web_redirect(error=f"{provider.title()} login is not configured yet")
    state = _encode_state(intent=intent, invite_token=invite_token, business_name=business_name)
    return RedirectResponse(authorization_url(provider, state))


@router.get("/{provider}/callback")
def oauth_callback(
    provider: str,
    db: Session = Depends(get_db),
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
) -> RedirectResponse:
    if error or not code or not state:
        return _web_redirect(error=error or "Social login was cancelled")
    try:
        profile = fetch_profile(provider, code)
        context = _decode_state(state)
    except HTTPException as exc:
        return _web_redirect(error=str(exc.detail))
    except Exception:
        return _web_redirect(error="Could not read the social profile")

    if not profile.get("provider_user_id"):
        return _web_redirect(error="Social login did not return a user id")

    account = db.scalar(
        select(OAuthAccount)
        .options(
            joinedload(OAuthAccount.user).joinedload(User.tenant),
            joinedload(OAuthAccount.user).joinedload(User.branch),
        )
        .where(
            OAuthAccount.provider == provider,
            OAuthAccount.provider_user_id == profile["provider_user_id"],
        )
    )
    if account and account.user.is_active:
        return _issue_redirect(account.user)

    intent = context.get("intent", "login")
    email = profile.get("email") or None
    full_name = profile.get("full_name") or "Social user"

    if intent == "join":
        invite = db.scalar(
            select(Invite)
            .options(joinedload(Invite.tenant), joinedload(Invite.branch))
            .where(Invite.token_hash == hash_invite_token(context.get("invite_token", "")))
        )
        if invite is None or invite.accepted_at is not None:
            return _web_redirect(error="Invite not found")
        expires = invite.expires_at
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=UTC)
        if expires < datetime.now(UTC):
            return _web_redirect(error="Invite has expired")
        user = User(
            tenant_id=invite.tenant_id,
            branch_id=invite.branch_id,
            email=invite.email or email,
            phone=invite.phone,
            password_hash=None,
            full_name=full_name,
            role=invite.role,
        )
        invite.accepted_at = datetime.now(UTC)
        db.add(user)
        db.flush()
        db.add(OAuthAccount(user_id=user.id, provider=provider, provider_user_id=profile["provider_user_id"]))
        db.commit()
        db.refresh(user)
        user.tenant = invite.tenant
        user.branch = invite.branch
        return _issue_redirect(user)

    if intent == "register":
        business_name = (context.get("business_name") or "").strip()
        if len(business_name) < 2:
            return _web_redirect(error="Enter a business name before continuing with social login")
        slug = slugify(business_name)
        if db.scalar(select(Tenant.id).where(Tenant.slug == slug)):
            slug = unique_slug(slug)
        tenant = Tenant(name=business_name, slug=slug)
        db.add(tenant)
        db.flush()
        branch = Branch(tenant_id=tenant.id, name="Main")
        db.add(branch)
        db.flush()
        user = User(
            tenant_id=tenant.id,
            branch_id=branch.id,
            email=email,
            phone=None,
            password_hash=None,
            full_name=full_name,
            role="owner",
        )
        db.add(user)
        db.flush()
        db.add(OAuthAccount(user_id=user.id, provider=provider, provider_user_id=profile["provider_user_id"]))
        db.commit()
        db.refresh(user)
        user.tenant = tenant
        user.branch = branch
        return _issue_redirect(user)

    if email:
        existing = db.scalar(
            select(User)
            .options(joinedload(User.tenant), joinedload(User.branch))
            .where(User.email == email)
        )
        if existing and existing.is_active:
            db.add(
                OAuthAccount(
                    user_id=existing.id,
                    provider=provider,
                    provider_user_id=profile["provider_user_id"],
                )
            )
            db.commit()
            return _issue_redirect(existing)

    return _web_redirect(error="No account for this social login. Create a business or use an invite link.")
