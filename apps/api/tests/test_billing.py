from fastapi.testclient import TestClient


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_register_starts_trial_and_subscribe(client: TestClient) -> None:
    registered = client.post(
        "/v1/auth/register",
        json={
            "business_name": "Billing Shop",
            "full_name": "Owner",
            "email": "bill@shop.lk",
            "password": "securepass",
        },
    )
    assert registered.status_code == 201, registered.text
    token = registered.json()["access_token"]

    plans = client.get("/v1/billing/plans", headers=_auth(token))
    assert plans.status_code == 200
    codes = {row["code"] for row in plans.json()}
    assert {"solo", "starter", "standard", "premium"} <= codes

    sub = client.get("/v1/billing/subscription", headers=_auth(token))
    assert sub.status_code == 200
    assert sub.json()["status"] == "trialing"
    assert sub.json()["plan"]["code"] == "starter"

    blocked = client.post(
        "/v1/branches",
        headers=_auth(token),
        json={"name": "Second"},
    )
    assert blocked.status_code == 403

    checkout = client.post(
        "/v1/billing/payhere/checkout",
        headers=_auth(token),
        json={"plan_code": "standard", "billing_interval": "yearly"},
    )
    assert checkout.status_code == 200
    assert checkout.json()["mode"] == "stub"
    assert checkout.json()["plan_code"] == "standard"

    activated = client.post(
        "/v1/billing/subscribe",
        headers=_auth(token),
        json={"plan_code": "standard", "billing_interval": "monthly"},
    )
    assert activated.status_code == 200, activated.text
    assert activated.json()["status"] == "active"
    assert activated.json()["plan"]["code"] == "standard"

    branch = client.post(
        "/v1/branches",
        headers=_auth(token),
        json={"name": "Second"},
    )
    assert branch.status_code == 201, branch.text


def test_platform_admin_lists_tenants(client: TestClient, monkeypatch) -> None:
    from app.core.config import settings

    monkeypatch.setattr(settings, "platform_admin_emails", "admin@platform.lk")
    registered = client.post(
        "/v1/auth/register",
        json={
            "business_name": "Admin Biz",
            "full_name": "Admin",
            "email": "admin@platform.lk",
            "password": "securepass",
        },
    )
    assert registered.status_code == 201
    login = client.post(
        "/v1/auth/login",
        json={"identifier": "admin@platform.lk", "password": "securepass"},
    )
    assert login.status_code == 200
    assert login.json()["user"]["is_platform_admin"] is True
    token = login.json()["access_token"]
    tenants = client.get("/v1/admin/tenants", headers=_auth(token))
    assert tenants.status_code == 200
    assert any(row["name"] == "Admin Biz" for row in tenants.json())
