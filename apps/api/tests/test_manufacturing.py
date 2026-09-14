from decimal import Decimal

from fastapi.testclient import TestClient


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register(client: TestClient, email: str = "mill@mfg.lk") -> str:
    response = client.post(
        "/v1/auth/register",
        json={
            "business_name": "Rice Mill",
            "full_name": "Owner",
            "email": email,
            "password": "securepass",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["access_token"]


def test_bom_and_production_run(client: TestClient) -> None:
    token = _register(client)
    paddy = client.post(
        "/v1/products",
        headers=_auth(token),
        json={"name": "Paddy", "unit_price": "100.00", "stock_on_hand": "100"},
    )
    rice = client.post(
        "/v1/products",
        headers=_auth(token),
        json={"name": "Milled Rice", "unit_price": "180.00", "stock_on_hand": "0"},
    )
    assert paddy.status_code == 201 and rice.status_code == 201
    paddy_id = paddy.json()["id"]
    rice_id = rice.json()["id"]

    bom = client.post(
        "/v1/boms",
        headers=_auth(token),
        json={
            "name": "Paddy to rice",
            "finished_product_id": rice_id,
            "expected_yield_pct": "80",
            "lines": [{"component_product_id": paddy_id, "quantity_per_output": "1"}],
        },
    )
    assert bom.status_code == 201, bom.text
    bom_id = bom.json()["id"]

    run = client.post(
        "/v1/production/runs",
        headers=_auth(token),
        json={
            "bom_id": bom_id,
            "planned_output_qty": "40",
            "actual_output_qty": "32",
            "note": "Morning batch",
        },
    )
    assert run.status_code == 201, run.text
    body = run.json()
    assert body["yield_pct"] == "80.00"
    assert body["wastage_pct"] == "20.00"
    # consume = 1 * 40 / 0.8 = 50 paddy
    assert Decimal(body["lines"][0]["quantity"]) == Decimal("50.000")
    assert Decimal(body["unit_cost"]) == Decimal("156.2500")  # 5000 / 32

    products = {row["name"]: row for row in client.get("/v1/products", headers=_auth(token)).json()}
    assert Decimal(products["Paddy"]["stock_on_hand"]) == Decimal("50")
    assert Decimal(products["Milled Rice"]["stock_on_hand"]) == Decimal("32")

    movements = client.get("/v1/inventory/movements", headers=_auth(token)).json()
    reasons = {row["reason"] for row in movements}
    assert "manufacture_consume" in reasons
    assert "manufacture_output" in reasons
