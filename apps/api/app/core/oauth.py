from typing import Any
from urllib.parse import urlencode

import httpx
from fastapi import HTTPException, status

from app.core.config import settings

PROVIDERS = ("google", "facebook", "tiktok")


def configured_providers() -> dict[str, bool]:
    return {
        "google": bool(settings.google_client_id and settings.google_client_secret),
        "facebook": bool(settings.facebook_client_id and settings.facebook_client_secret),
        "tiktok": bool(settings.tiktok_client_key and settings.tiktok_client_secret),
    }


def redirect_uri(provider: str) -> str:
    return f"{settings.oauth_redirect_base.rstrip('/')}/v1/auth/oauth/{provider}/callback"


def authorization_url(provider: str, state: str) -> str:
    uri = redirect_uri(provider)
    if provider == "google":
        query = urlencode(
            {
                "client_id": settings.google_client_id,
                "redirect_uri": uri,
                "response_type": "code",
                "scope": "openid email profile",
                "state": state,
                "access_type": "online",
                "prompt": "select_account",
            }
        )
        return f"https://accounts.google.com/o/oauth2/v2/auth?{query}"
    if provider == "facebook":
        query = urlencode(
            {
                "client_id": settings.facebook_client_id,
                "redirect_uri": uri,
                "response_type": "code",
                "scope": "public_profile,email",
                "state": state,
            }
        )
        return f"https://www.facebook.com/v21.0/dialog/oauth?{query}"
    query = urlencode(
        {
            "client_key": settings.tiktok_client_key,
            "redirect_uri": uri,
            "response_type": "code",
            "scope": "user.info.basic",
            "state": state,
        }
    )
    return f"https://www.tiktok.com/v2/auth/authorize/?{query}"


def _require_provider(provider: str) -> None:
    if provider not in PROVIDERS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown provider")
    if not configured_providers()[provider]:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=f"{provider.title()} login is not configured yet",
        )


def fetch_profile(provider: str, code: str) -> dict[str, str]:
    _require_provider(provider)
    uri = redirect_uri(provider)
    with httpx.Client(timeout=20) as client:
        if provider == "google":
            token = client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": settings.google_client_id,
                    "client_secret": settings.google_client_secret,
                    "redirect_uri": uri,
                    "grant_type": "authorization_code",
                },
            )
            token.raise_for_status()
            access = token.json()["access_token"]
            info = client.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {access}"},
            )
            info.raise_for_status()
            body = info.json()
            return {
                "provider_user_id": str(body["sub"]),
                "full_name": str(body.get("name") or "Google user"),
                "email": str(body["email"]).lower() if body.get("email") else "",
            }
        if provider == "facebook":
            token = client.get(
                "https://graph.facebook.com/v21.0/oauth/access_token",
                params={
                    "client_id": settings.facebook_client_id,
                    "client_secret": settings.facebook_client_secret,
                    "redirect_uri": uri,
                    "code": code,
                },
            )
            token.raise_for_status()
            access = token.json()["access_token"]
            info = client.get(
                "https://graph.facebook.com/me",
                params={"fields": "id,name,email", "access_token": access},
            )
            info.raise_for_status()
            body = info.json()
            return {
                "provider_user_id": str(body["id"]),
                "full_name": str(body.get("name") or "Facebook user"),
                "email": str(body["email"]).lower() if body.get("email") else "",
            }
        token = client.post(
            "https://open.tiktokapis.com/v2/oauth/token/",
            data={
                "client_key": settings.tiktok_client_key,
                "client_secret": settings.tiktok_client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": uri,
            },
        )
        token.raise_for_status()
        payload: dict[str, Any] = token.json()
        access = payload.get("access_token") or payload.get("data", {}).get("access_token")
        info = client.get(
            "https://open.tiktokapis.com/v2/user/info/",
            params={"fields": "open_id,display_name"},
            headers={"Authorization": f"Bearer {access}"},
        )
        info.raise_for_status()
        user = info.json().get("data", {}).get("user", {})
        return {
            "provider_user_id": str(user.get("open_id") or ""),
            "full_name": str(user.get("display_name") or "TikTok user"),
            "email": "",
        }
