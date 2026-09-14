from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator, model_validator


class BomLineIn(BaseModel):
    component_product_id: str
    quantity_per_output: Decimal = Field(gt=0, max_digits=12, decimal_places=3)


class BomCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    finished_product_id: str
    expected_yield_pct: Decimal = Field(default=Decimal("100"), gt=0, le=100, max_digits=6, decimal_places=2)
    lines: list[BomLineIn] = Field(min_length=1)

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value

    @model_validator(mode="after")
    def unique_components(self) -> "BomCreate":
        ids = [line.component_product_id for line in self.lines]
        if len(ids) != len(set(ids)):
            raise ValueError("Duplicate component products in BOM")
        if self.finished_product_id in ids:
            raise ValueError("Finished product cannot be a BOM component of itself")
        return self


class BomLineOut(BaseModel):
    id: str
    component_product_id: str
    quantity_per_output: Decimal

    model_config = {"from_attributes": True}


class BomOut(BaseModel):
    id: str
    name: str
    finished_product_id: str
    expected_yield_pct: Decimal
    is_active: bool
    lines: list[BomLineOut]

    model_config = {"from_attributes": True}


class ProductionRunCreate(BaseModel):
    bom_id: str
    planned_output_qty: Decimal = Field(gt=0, max_digits=12, decimal_places=3)
    actual_output_qty: Decimal = Field(ge=0, max_digits=12, decimal_places=3)
    note: str | None = Field(default=None, max_length=500)


class ProductionRunLineOut(BaseModel):
    id: str
    component_product_id: str
    quantity: Decimal
    unit_cost: Decimal
    line_cost: Decimal

    model_config = {"from_attributes": True}


class ProductionRunOut(BaseModel):
    id: str
    bom_id: str
    finished_product_id: str
    planned_output_qty: Decimal
    actual_output_qty: Decimal
    yield_pct: Decimal
    wastage_pct: Decimal
    unit_cost: Decimal
    total_component_cost: Decimal
    status: str
    note: str | None = None
    created_by_user_id: str
    created_at: datetime
    lines: list[ProductionRunLineOut]

    model_config = {"from_attributes": True}
