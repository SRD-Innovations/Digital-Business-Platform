from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator, model_validator


def _blank_to_none(value: object) -> object:
    if isinstance(value, str) and not value.strip():
        return None
    return value


class SupplierCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    phone: str | None = Field(default=None, max_length=32)
    email: str | None = Field(default=None, max_length=255)
    note: str | None = Field(default=None, max_length=500)

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("phone", "email", "note", mode="before")
    @classmethod
    def blank_optional(cls, value: object) -> object:
        return _blank_to_none(value)


class SupplierUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    phone: str | None = Field(default=None, max_length=32)
    email: str | None = Field(default=None, max_length=255)
    note: str | None = Field(default=None, max_length=500)
    is_active: bool | None = None

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("phone", "email", "note", mode="before")
    @classmethod
    def blank_optional(cls, value: object) -> object:
        return _blank_to_none(value)


class SupplierOut(BaseModel):
    id: str
    name: str
    phone: str | None = None
    email: str | None = None
    note: str | None = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ReceiveLine(BaseModel):
    product_id: str
    quantity: Decimal = Field(gt=0, max_digits=12, decimal_places=3)
    unit_cost: Decimal = Field(default=Decimal("0"), ge=0, max_digits=12, decimal_places=2)
    batch_code: str | None = Field(default=None, max_length=64)
    expiry_date: date | None = None


class PurchaseReceiveRequest(BaseModel):
    supplier_id: str
    branch_id: str | None = None
    note: str | None = Field(default=None, max_length=500)
    lines: list[ReceiveLine] = Field(min_length=1)

    @model_validator(mode="after")
    def require_lines(self) -> "PurchaseReceiveRequest":
        if not self.lines:
            raise ValueError("At least one line is required")
        return self


class PurchaseReceiptLineOut(BaseModel):
    id: str
    product_id: str
    quantity: Decimal
    unit_cost: Decimal
    batch_code: str | None = None
    expiry_date: date | None = None

    model_config = {"from_attributes": True}


class PurchaseReceiptOut(BaseModel):
    id: str
    supplier_id: str
    branch_id: str | None = None
    received_by_user_id: str
    status: str
    note: str | None = None
    received_at: datetime
    lines: list[PurchaseReceiptLineOut]

    model_config = {"from_attributes": True}


class InventoryMovementOut(BaseModel):
    id: str
    product_id: str
    quantity: Decimal
    reason: str
    ref_type: str | None = None
    ref_id: str | None = None
    note: str | None = None
    created_by_user_id: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class StockAdjustmentRequest(BaseModel):
    product_id: str
    quantity_delta: Decimal = Field(max_digits=12, decimal_places=3)
    note: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def non_zero(self) -> "StockAdjustmentRequest":
        if self.quantity_delta == 0:
            raise ValueError("quantity_delta cannot be zero")
        return self


class SalesReportDay(BaseModel):
    day: str
    sale_count: int
    total: Decimal


class SalesReportProduct(BaseModel):
    product_id: str | None
    product_name: str
    quantity: Decimal
    revenue: Decimal


class SalesReportPayment(BaseModel):
    method: str
    amount: Decimal


class SalesReportOut(BaseModel):
    from_date: str | None
    to_date: str | None
    completed_sales: int
    gross_total: Decimal
    by_day: list[SalesReportDay]
    top_products: list[SalesReportProduct]
    by_payment: list[SalesReportPayment]
