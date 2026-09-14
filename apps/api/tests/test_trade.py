from decimal import Decimal

from fastapi.testclient import TestClient


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register(client: TestClient, email: str = "trade@shop.lk") -> str:
    response = client.post(
        "/v1/auth/register",
        json={
            "business_name": "Trade Shop",
            "full_name": "Owner",
            "email": email,
            "password": "securepass",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["access_token"]


def test_wholesale_tiers_and_batch_fefo(client: TestClient) -> None:
    token = _register(client)
    product = client.post(
        "/v1/products",
        headers=_auth(token),
        json={
            "name": "Paracetamol",
            "unit_price": "50.00",
            "stock_on_hand": "0",
            "track_batches": True,
        },
    )
    assert product.status_code == 201, product.text
    product_id = product.json()["id"]
    assert product.json()["track_batches"] is True

    tiers = client.put(
        f"/v1/products/{product_id}/price-tiers",
        headers=_auth(token),
        json={"tiers": [{"min_qty": "10", "unit_price": "40.00"}]},
    )
    assert tiers.status_code == 200, tiers.text
    assert tiers.json()[0]["unit_price"] == "40.00"

    supplier = client.post(
        "/v1/suppliers",
        headers=_auth(token),
        json={"name": "Pharma Co"},
    )
    supplier_id = supplier.json()["id"]
    price = client.put(
        f"/v1/suppliers/{supplier_id}/prices",
        headers=_auth(token),
        json={"product_id": product_id, "unit_cost": "30.00"},
    )
    assert price.status_code == 200
    assert price.json()["unit_cost"] == "30.00"

    receive = client.post(
        "/v1/purchases/receive",
        headers=_auth(token),
        json={
            "supplier_id": supplier_id,
            "lines": [
                {
                    "product_id": product_id,
                    "quantity": "5",
                    "unit_cost": "30.00",
                    "batch_code": "B-OLD",
                    "expiry_date": "2026-01-01",
                },
                {
                    "product_id": product_id,
                    "quantity": "10",
                    "unit_cost": "30.00",
                    "batch_code": "B-NEW",
                    "expiry_date": "2027-01-01",
                },
            ],
        },
    )
    assert receive.status_code == 201, receive.text
    batches = client.get(f"/v1/products/{product_id}/batches", headers=_auth(token))
    assert batches.status_code == 200
    assert len(batches.json()) == 2

    client.post("/v1/pos/shifts/open", headers=_auth(token), json={"opening_cash": "0"})
    # Qty 10 should use wholesale 40 and consume oldest batch first (5) then new (5)
    sale = client.post(
        "/v1/pos/checkout",
        headers=_auth(token),
        json={
            "lines": [{"product_id": product_id, "quantity": "10"}],
            "payments": [{"method": "cash", "amount": "400.00"}],
        },
    )
    assert sale.status_code == 201, sale.text
    assert sale.json()["total"] == "400.00"
    assert len(sale.json()["lines"]) == 2
    assert {line["batch_id"] for line in sale.json()["lines"]}

    left = client.get(f"/v1/products/{product_id}/batches", headers=_auth(token)).json()
    by_code = {row["batch_code"]: Decimal(row["quantity"]) for row in left}
    assert by_code["B-OLD"] == Decimal("0")
    assert by_code["B-NEW"] == Decimal("5")
