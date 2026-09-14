from decimal import Decimal

from fastapi.testclient import TestClient


def _auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register(client: TestClient, email: str = "owner@erp.lk") -> str:
    response = client.post(
        "/v1/auth/register",
        json={
            "business_name": "ERP Shop",
            "full_name": "Owner",
            "email": email,
            "password": "securepass",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["access_token"]


def test_supplier_receive_and_sales_report(client: TestClient) -> None:
    token = _register(client)
    supplier = client.post(
        "/v1/suppliers",
        headers=_auth_header(token),
        json={"name": "Ceylon Traders", "phone": "0112223344"},
    )
    assert supplier.status_code == 201, supplier.text
    supplier_id = supplier.json()["id"]

    product = client.post(
        "/v1/products",
        headers=_auth_header(token),
        json={"name": "Rice 5kg", "unit_price": "1800.00", "stock_on_hand": "2"},
    )
    assert product.status_code == 201, product.text
    product_id = product.json()["id"]
    assert Decimal(product.json()["stock_on_hand"]) == Decimal("2")

    receive = client.post(
        "/v1/purchases/receive",
        headers=_auth_header(token),
        json={
            "supplier_id": supplier_id,
            "lines": [{"product_id": product_id, "quantity": "8", "unit_cost": "1500.00"}],
        },
    )
    assert receive.status_code == 201, receive.text
    assert len(receive.json()["lines"]) == 1

    stock = client.get("/v1/products", headers=_auth_header(token))
    assert Decimal(stock.json()[0]["stock_on_hand"]) == Decimal("10")

    movements = client.get("/v1/inventory/movements", headers=_auth_header(token))
    assert movements.status_code == 200
    reasons = {row["reason"] for row in movements.json()}
    assert "opening" in reasons
    assert "purchase_receive" in reasons

    shift = client.post(
        "/v1/pos/shifts/open",
        headers=_auth_header(token),
        json={"opening_cash": "0"},
    )
    assert shift.status_code == 201
    sale = client.post(
        "/v1/pos/checkout",
        headers=_auth_header(token),
        json={
            "lines": [{"product_id": product_id, "quantity": "1"}],
            "payments": [{"method": "cash", "amount": "1800.00"}],
        },
    )
    assert sale.status_code == 201, sale.text

    report = client.get("/v1/reports/sales", headers=_auth_header(token))
    assert report.status_code == 200, report.text
    body = report.json()
    assert body["completed_sales"] == 1
    assert body["gross_total"] == "1800.00"
    assert body["top_products"][0]["product_name"] == "Rice 5kg"
    assert body["by_payment"][0]["method"] == "cash"


def test_stock_adjustment(client: TestClient) -> None:
    token = _register(client, "adj@erp.lk")
    product = client.post(
        "/v1/products",
        headers=_auth_header(token),
        json={"name": "Sugar", "unit_price": "250.00", "stock_on_hand": "5"},
    )
    product_id = product.json()["id"]
    adjusted = client.post(
        "/v1/inventory/adjustments",
        headers=_auth_header(token),
        json={"product_id": product_id, "quantity_delta": "-1.5", "note": "Damaged"},
    )
    assert adjusted.status_code == 201, adjusted.text
    assert adjusted.json()["reason"] == "adjustment"
    stock = client.get("/v1/products", headers=_auth_header(token))
    assert Decimal(stock.json()[0]["stock_on_hand"]) == Decimal("3.5")
