from fastapi.testclient import TestClient


def _auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register(client: TestClient, email: str = "owner@mill.lk") -> str:
    response = client.post(
        "/v1/auth/register",
        json={
            "business_name": "Nuwara Rice Mill",
            "full_name": "Amal Perera",
            "email": email,
            "password": "securepass",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["access_token"]


def test_owner_creates_branch_and_invites_cashier(client: TestClient) -> None:
    token = _register(client)
    branch = client.post(
        "/v1/branches",
        headers=_auth_header(token),
        json={"name": "Kandy"},
    )
    assert branch.status_code == 201, branch.text

    invite = client.post(
        "/v1/invites",
        headers=_auth_header(token),
        json={
            "email": "cashier@mill.lk",
            "role": "cashier",
            "branch_id": branch.json()["id"],
        },
    )
    assert invite.status_code == 201, invite.text
    join_token = invite.json()["token"]
    assert invite.json()["join_path"].startswith("/join?token=")

    accepted = client.post(
        "/v1/invites/accept",
        json={
            "token": join_token,
            "full_name": "Nimali Cashier",
            "password": "cashierpw",
        },
    )
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["user"]["role"] == "cashier"
    assert accepted.json()["user"]["tenant"]["name"] == "Nuwara Rice Mill"

    cashier_token = accepted.json()["access_token"]
    forbidden = client.post(
        "/v1/invites",
        headers=_auth_header(cashier_token),
        json={"email": "other@mill.lk", "role": "cashier"},
    )
    assert forbidden.status_code == 403

    cannot_branch = client.post(
        "/v1/branches",
        headers=_auth_header(cashier_token),
        json={"name": "Colombo"},
    )
    assert cannot_branch.status_code == 403

    team = client.get("/v1/team", headers=_auth_header(token))
    assert team.status_code == 200
    emails = {member["email"] for member in team.json()}
    assert emails == {"owner@mill.lk", "cashier@mill.lk"}


def test_manager_cannot_invite_manager(client: TestClient) -> None:
    owner_token = _register(client, "boss@shop.lk")
    invite = client.post(
        "/v1/invites",
        headers=_auth_header(owner_token),
        json={"email": "mgr@shop.lk", "role": "manager"},
    )
    assert invite.status_code == 201
    accepted = client.post(
        "/v1/invites/accept",
        json={
            "token": invite.json()["token"],
            "full_name": "Manager",
            "password": "managerpw",
        },
    )
    manager_token = accepted.json()["access_token"]
    blocked = client.post(
        "/v1/invites",
        headers=_auth_header(manager_token),
        json={"email": "peer@shop.lk", "role": "manager"},
    )
    assert blocked.status_code == 403
