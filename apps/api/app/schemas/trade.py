from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field, model_validator


class PriceTierIn(BaseModel):
    min_qty: Decimal = Field(gt=0, max_digits=12, decimal_places=3)
    unit_price: Decimal = Field(ge=0, max_digits=12, decimal_places=2)


class PriceTierOut(BaseModel):
    id: str
    product_id: str
    min_qty: Decimal
    unit_price: Decimal

    model_config = {"from_attributes": True}


class PriceTiersReplace(BaseModel):
    tiers: list[PriceTierIn] = Field(default_factory=list)

    @model_validator(mode="after")
    def unique_min_qty(self) -> "PriceTiersReplace":
        mins = [tier.min_qty for tier in self.tiers]
        if len(mins) != len(set(mins)):
            raise ValueError("Duplicate min_qty in tiers")
        return self


class SupplierPriceIn(BaseModel):
    product_id: str
    unit_cost: Decimal = Field(ge=0, max_digits=12, decimal_places=2)


class SupplierPriceOut(BaseModel):
    id: str
    supplier_id: str
    product_id: str
    unit_cost: Decimal

    model_config = {"from_attributes": True}


class ProductBatchOut(BaseModel):
    id: str
    product_id: str
    batch_code: str
    expiry_date: date | None = None
    quantity: Decimal

    model_config = {"from_attributes": True}


class TrackBatchesUpdate(BaseModel):
    track_batches: bool
