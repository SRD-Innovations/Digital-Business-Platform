from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator


class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    sku: str | None = Field(default=None, max_length=64)
    barcode: str | None = Field(default=None, max_length=64)
    unit_price: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    stock_on_hand: Decimal = Field(default=Decimal("0"), ge=0, max_digits=12, decimal_places=3)
    track_batches: bool = False

    @field_validator("sku", "barcode", mode="before")
    @classmethod
    def blank_to_none(cls, value: object) -> object:
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    sku: str | None = Field(default=None, max_length=64)
    barcode: str | None = Field(default=None, max_length=64)
    unit_price: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    stock_on_hand: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=3)
    track_batches: bool | None = None
    is_active: bool | None = None

    @field_validator("sku", "barcode", mode="before")
    @classmethod
    def blank_to_none(cls, value: object) -> object:
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value


class ProductOut(BaseModel):
    id: str
    name: str
    sku: str | None = None
    barcode: str | None = None
    unit_price: Decimal
    stock_on_hand: Decimal
    track_batches: bool = False
    is_active: bool

    model_config = {"from_attributes": True}


class CheckoutLine(BaseModel):
    product_id: str
    quantity: Decimal = Field(gt=0, max_digits=12, decimal_places=3)


class CheckoutPayment(BaseModel):
    method: str
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)

    @field_validator("method")
    @classmethod
    def method_allowed(cls, value: str) -> str:
        if value not in {"cash", "card", "credit"}:
            raise ValueError("Payment method must be cash, card, or credit")
        return value


class CheckoutRequest(BaseModel):
    branch_id: str | None = None
    discount_total: Decimal = Field(default=Decimal("0"), ge=0, max_digits=12, decimal_places=2)
    note: str | None = Field(default=None, max_length=500)
    lines: list[CheckoutLine] = Field(min_length=1)
    payments: list[CheckoutPayment] = Field(min_length=1)
    parked_bill_id: str | None = None
    client_op_id: str | None = Field(default=None, min_length=8, max_length=64)
    device_id: str | None = Field(default=None, min_length=4, max_length=64)

    @model_validator(mode="after")
    def require_lines(self) -> "CheckoutRequest":
        if not self.lines:
            raise ValueError("At least one line is required")
        if not self.payments:
            raise ValueError("At least one payment is required")
        return self


class SaleLineOut(BaseModel):
    id: str
    product_id: str | None = None
    product_name: str
    quantity: Decimal
    unit_price: Decimal
    line_total: Decimal
    batch_id: str | None = None

    model_config = {"from_attributes": True}


class SalePaymentOut(BaseModel):
    id: str
    method: str
    amount: Decimal

    model_config = {"from_attributes": True}


class SaleOut(BaseModel):
    id: str
    receipt_number: str
    status: str
    branch_id: str | None = None
    cashier_user_id: str
    shift_id: str | None = None
    refund_of_sale_id: str | None = None
    client_op_id: str | None = None
    device_id: str | None = None
    subtotal: Decimal
    discount_total: Decimal
    total: Decimal
    note: str | None = None
    created_at: datetime
    lines: list[SaleLineOut]
    payments: list[SalePaymentOut]

    model_config = {"from_attributes": True}


class ShiftOpen(BaseModel):
    branch_id: str | None = None
    opening_cash: Decimal = Field(default=Decimal("0"), ge=0, max_digits=12, decimal_places=2)


class ShiftClose(BaseModel):
    closing_cash: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    note: str | None = Field(default=None, max_length=500)


class ShiftOut(BaseModel):
    id: str
    branch_id: str | None = None
    opened_by_user_id: str
    closed_by_user_id: str | None = None
    opening_cash: Decimal
    closing_cash: Decimal | None = None
    expected_cash: Decimal | None = None
    cash_sales_total: Decimal
    card_sales_total: Decimal
    credit_sales_total: Decimal
    status: str
    opened_at: datetime
    closed_at: datetime | None = None
    note: str | None = None
    variance: Decimal | None = None

    model_config = {"from_attributes": True}


class ParkBillRequest(BaseModel):
    label: str = Field(default="Held", min_length=1, max_length=120)
    branch_id: str | None = None
    discount_total: Decimal = Field(default=Decimal("0"), ge=0, max_digits=12, decimal_places=2)
    note: str | None = Field(default=None, max_length=500)
    lines: list[CheckoutLine] = Field(min_length=1)


class ParkedBillOut(BaseModel):
    id: str
    label: str
    branch_id: str | None = None
    cashier_user_id: str
    cart_json: dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}


class ReturnLine(BaseModel):
    sale_line_id: str
    quantity: Decimal = Field(gt=0, max_digits=12, decimal_places=3)


class ReturnRequest(BaseModel):
    lines: list[ReturnLine] | None = None
    restock: bool = True
    note: str | None = Field(default=None, max_length=500)
