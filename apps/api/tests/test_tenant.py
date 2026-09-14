from fastapi.testclient import TestClient


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_get_and_update_business_profile(client: TestClient) -> None:
    registered = client.post(
        "/v1/auth/register",
        json={
            "business_name": "Pilot Mart",
            "full_name": "Owner",
            "email": "pilot@mart.lk",
            "password": "securepass",
        },
    )
    assert registered.status_code == 201, registered.text
    token = registered.json()["access_token"]
    tenant = registered.json()["user"]["tenant"]
    assert tenant["name"] == "Pilot Mart"
    assert tenant["tin"] is None

    got = client.get("/v1/tenant", headers=_auth(token))
    assert got.status_code == 200
    assert got.json()["slug"] == tenant["slug"]

    updated = client.patch(
        "/v1/tenant",
        headers=_auth(token),
        json={
            "legal_name": "Pilot Mart (Pvt) Ltd",
            "address_line1": "12 Galle Road",
            "city": "Colombo",
            "phone": "0112345678",
            "email": "hello@pilotmart.lk",
            "tin": "123456789",
            "vat_number": "VAT-123456789",
        },
    )
    assert updated.status_code == 200, updated.text
    body = updated.json()
    assert body["legal_name"] == "Pilot Mart (Pvt) Ltd"
    assert body["tin"] == "123456789"
    assert body["vat_number"] == "VAT-123456789"
    assert body["city"] == "Colombo"

    me = client.get("/v1/auth/me", headers=_auth(token))
    assert me.status_code == 200
    assert me.json()["tenant"]["tin"] == "123456789"
