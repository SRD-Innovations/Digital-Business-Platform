from fastapi.testclient import TestClient


def test_register_login_and_me(client: TestClient) -> None:
    register = client.post(
        "/v1/auth/register",
        json={
            "business_name": "Nuwara Rice Mill",
            "full_name": "Amal Perera",
            "email": "owner@mill.lk",
            "password": "securepass",
        },
    )
    assert register.status_code == 201, register.text
    body = register.json()
    assert body["token_type"] == "bearer"
    assert body["user"]["role"] == "owner"
    assert body["user"]["tenant"]["name"] == "Nuwara Rice Mill"
    assert body["user"]["branch"]["name"] == "Main"

    duplicate = client.post(
        "/v1/auth/register",
        json={
            "business_name": "Other",
            "full_name": "Amal Perera",
            "email": "owner@mill.lk",
            "password": "securepass",
        },
    )
    assert duplicate.status_code == 409

    login = client.post(
        "/v1/auth/login",
        json={"identifier": "owner@mill.lk", "password": "securepass"},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]

    me = client.get("/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == "owner@mill.lk"

    branches = client.get("/v1/branches", headers={"Authorization": f"Bearer {token}"})
    assert branches.status_code == 200
    assert branches.json()[0]["name"] == "Main"


def test_login_rejects_bad_password(client: TestClient) -> None:
    client.post(
        "/v1/auth/register",
        json={
            "business_name": "Shop",
            "full_name": "Kasun",
            "email": "kasun@shop.lk",
            "password": "securepass",
        },
    )
    response = client.post(
        "/v1/auth/login",
        json={"identifier": "kasun@shop.lk", "password": "wrongpass"},
    )
    assert response.status_code == 401


def test_me_requires_auth(client: TestClient) -> None:
    response = client.get("/v1/auth/me")
    assert response.status_code == 401
