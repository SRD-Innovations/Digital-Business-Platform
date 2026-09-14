from decimal import Decimal

from fastapi.testclient import TestClient


def _auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register(client: TestClient, email: str = "owner@pos.lk") -> str:
    response = client.post(
        "/v1/auth/register",
        json={
            "business_name": "POS Shop",
            "full_name": "Owner",
            "email": email,
            "password": "securepass",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["access_token"]


def _open_shift(client: TestClient, token: str, opening_cash: str = "1000.00") -> str:
    response = client.post(
        "/v1/pos/shifts/open",
        headers=_auth_header(token),
        json={"opening_cash": opening_cash},
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def test_create_product_and_checkout(client: TestClient) -> None:
    token = _register(client)
    _open_shift(client, token)
    product = client.post(
        "/v1/products",
        headers=_auth_header(token),
        json={
            "name": "Samba Rice 5kg",
            "sku": "RICE-5",
            "barcode": "4790001234567",
            "unit_price": "1850.00",
            "stock_on_hand": "10",
        },
    )
    assert product.status_code == 201, product.text
    product_id = product.json()["id"]

    sale = client.post(
        "/v1/pos/checkout",
        headers=_auth_header(token),
        json={
            "lines": [{"product_id": product_id, "quantity": "2"}],
            "payments": [
                {"method": "cash", "amount": "2000.00"},
                {"method": "card", "amount": "1700.00"},
            ],
        },
    )
    assert sale.status_code == 201, sale.text
    body = sale.json()
    assert body["total"] == "3700.00"
    assert len(body["payments"]) == 2
    assert body["shift_id"]

    products = client.get("/v1/products", headers=_auth_header(token))
    assert Decimal(products.json()[0]["stock_on_hand"]) == Decimal("8")

    shift = client.get("/v1/pos/shifts/current", headers=_auth_header(token))
    assert shift.status_code == 200
    assert shift.json()["cash_sales_total"] == "2000.00"
    assert shift.json()["card_sales_total"] == "1700.00"


def test_checkout_requires_open_shift(client: TestClient) -> None:
    token = _register(client, "noshift@pos.lk")
    product = client.post(
        "/v1/products",
        headers=_auth_header(token),
        json={"name": "Tea", "unit_price": "100.00", "stock_on_hand": "5"},
    )
    blocked = client.post(
        "/v1/pos/checkout",
        headers=_auth_header(token),
        json={
            "lines": [{"product_id": product.json()["id"], "quantity": "1"}],
            "payments": [{"method": "cash", "amount": "100.00"}],
        },
    )
    assert blocked.status_code == 400
    assert "shift" in blocked.json()["detail"].lower()


def test_park_resume_void_and_return(client: TestClient) -> None:
    token = _register(client, "flow@pos.lk")
    shift_id = _open_shift(client, token, "500.00")
    product = client.post(
        "/v1/products",
        headers=_auth_header(token),
        json={"name": "Sugar", "unit_price": "250.00", "stock_on_hand": "5"},
    )
    product_id = product.json()["id"]

    parked = client.post(
        "/v1/pos/park",
        headers=_auth_header(token),
        json={
            "label": "Table 1",
            "lines": [{"product_id": product_id, "quantity": "1"}],
        },
    )
    assert parked.status_code == 201, parked.text
    parked_id = parked.json()["id"]

    sale = client.post(
        "/v1/pos/checkout",
        headers=_auth_header(token),
        json={
            "parked_bill_id": parked_id,
            "lines": [{"product_id": product_id, "quantity": "1"}],
            "payments": [{"method": "cash", "amount": "250.00"}],
        },
    )
    assert sale.status_code == 201, sale.text
    sale_id = sale.json()["id"]
    listed = client.get("/v1/pos/parked", headers=_auth_header(token))
    assert listed.json() == []

    returned = client.post(
        f"/v1/sales/{sale_id}/return",
        headers=_auth_header(token),
        json={"restock": True},
    )
    assert returned.status_code == 201, returned.text
    assert returned.json()["status"] == "returned"
    assert returned.json()["refund_of_sale_id"] == sale_id
    stock = client.get("/v1/products", headers=_auth_header(token))
    assert Decimal(stock.json()[0]["stock_on_hand"]) == Decimal("5")

    sale2 = client.post(
        "/v1/pos/checkout",
        headers=_auth_header(token),
        json={
            "lines": [{"product_id": product_id, "quantity": "1"}],
            "payments": [{"method": "cash", "amount": "250.00"}],
        },
    )
    voided = client.post(
        f"/v1/sales/{sale2.json()['id']}/void",
        headers=_auth_header(token),
    )
    assert voided.status_code == 200
    assert voided.json()["status"] == "voided"

    closed = client.post(
        f"/v1/pos/shifts/{shift_id}/close",
        headers=_auth_header(token),
        json={"closing_cash": "750.00", "note": "End of day"},
    )
    assert closed.status_code == 200, closed.text
    assert closed.json()["status"] == "closed"
    assert closed.json()["expected_cash"] == "500.00"
    assert closed.json()["variance"] == "250.00"


def test_cashier_can_checkout_but_not_create_product(client: TestClient) -> None:
    owner = _register(client, "boss@pos.lk")
    _open_shift(client, owner)
    product = client.post(
        "/v1/products",
        headers=_auth_header(owner),
        json={"name": "Sugar", "unit_price": "250.00", "stock_on_hand": "5"},
    )
    assert product.status_code == 201
    invite = client.post(
        "/v1/invites",
        headers=_auth_header(owner),
        json={"phone": "0771112233", "role": "cashier"},
    )
    assert invite.status_code == 201
    accepted = client.post(
        "/v1/invites/accept",
        json={
            "token": invite.json()["token"],
            "full_name": "Cashier",
            "password": "cashierpw",
        },
    )
    cashier = accepted.json()["access_token"]
    blocked = client.post(
        "/v1/products",
        headers=_auth_header(cashier),
        json={"name": "Blocked", "unit_price": "10.00"},
    )
    assert blocked.status_code == 403
    _open_shift(client, cashier)
    sale = client.post(
        "/v1/pos/checkout",
        headers=_auth_header(cashier),
        json={
            "lines": [{"product_id": product.json()["id"], "quantity": "1"}],
            "payments": [{"method": "cash", "amount": "250.00"}],
        },
    )
    assert sale.status_code == 201, sale.text
