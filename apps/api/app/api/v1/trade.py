from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.db import get_db
from app.models.product import Product
from app.models.supplier import Supplier
from app.models.trade import PriceTier, ProductBatch, SupplierPrice
from app.models.user import User
from app.schemas.trade import (
    PriceTierOut,
    PriceTiersReplace,
    ProductBatchOut,
    SupplierPriceIn,
    SupplierPriceOut,
    TrackBatchesUpdate,
)

CATALOG_ROLES = ("owner", "manager", "stock_keeper")
READ_ROLES = ("owner", "manager", "stock_keeper", "cashier", "accountant")

router = APIRouter(tags=["trade"])


def _product(db: Session, tenant_id: str, product_id: str) -> Product:
    product = db.scalar(select(Product).where(Product.id == product_id, Product.tenant_id == tenant_id))
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return product


@router.get("/products/{product_id}/price-tiers", response_model=list[PriceTierOut])
def list_price_tiers(
    product_id: str,
    user: User = Depends(require_roles(*READ_ROLES)),
    db: Session = Depends(get_db),
) -> list[PriceTier]:
    _product(db, user.tenant_id, product_id)
    return list(
        db.scalars(
            select(PriceTier)
            .where(PriceTier.tenant_id == user.tenant_id, PriceTier.product_id == product_id)
            .order_by(PriceTier.min_qty)
        )
    )


@router.put("/products/{product_id}/price-tiers", response_model=list[PriceTierOut])
def replace_price_tiers(
    product_id: str,
    body: PriceTiersReplace,
    user: User = Depends(require_roles(*CATALOG_ROLES)),
    db: Session = Depends(get_db),
) -> list[PriceTier]:
    _product(db, user.tenant_id, product_id)
    existing = list(
        db.scalars(
            select(PriceTier).where(
                PriceTier.tenant_id == user.tenant_id, PriceTier.product_id == product_id
            )
        )
    )
    for row in existing:
        db.delete(row)
    db.flush()
    created = [
        PriceTier(
            tenant_id=user.tenant_id,
            product_id=product_id,
            min_qty=tier.min_qty,
            unit_price=tier.unit_price,
        )
        for tier in body.tiers
    ]
    for row in created:
        db.add(row)
    db.commit()
    return list(
        db.scalars(
            select(PriceTier)
            .where(PriceTier.tenant_id == user.tenant_id, PriceTier.product_id == product_id)
            .order_by(PriceTier.min_qty)
        )
    )


@router.patch("/products/{product_id}/track-batches", response_model=dict)
def set_track_batches(
    product_id: str,
    body: TrackBatchesUpdate,
    user: User = Depends(require_roles(*CATALOG_ROLES)),
    db: Session = Depends(get_db),
) -> dict:
    product = _product(db, user.tenant_id, product_id)
    product.track_batches = body.track_batches
    db.commit()
    return {"id": product.id, "track_batches": product.track_batches}


@router.get("/products/{product_id}/batches", response_model=list[ProductBatchOut])
def list_batches(
    product_id: str,
    user: User = Depends(require_roles(*READ_ROLES)),
    db: Session = Depends(get_db),
) -> list[ProductBatch]:
    _product(db, user.tenant_id, product_id)
    return list(
        db.scalars(
            select(ProductBatch)
            .where(ProductBatch.tenant_id == user.tenant_id, ProductBatch.product_id == product_id)
            .order_by(ProductBatch.expiry_date.asc().nulls_last(), ProductBatch.batch_code)
        )
    )


@router.get("/suppliers/{supplier_id}/prices", response_model=list[SupplierPriceOut])
def list_supplier_prices(
    supplier_id: str,
    user: User = Depends(require_roles(*READ_ROLES)),
    db: Session = Depends(get_db),
) -> list[SupplierPrice]:
    supplier = db.scalar(
        select(Supplier).where(Supplier.id == supplier_id, Supplier.tenant_id == user.tenant_id)
    )
    if supplier is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
    return list(
        db.scalars(
            select(SupplierPrice).where(
                SupplierPrice.tenant_id == user.tenant_id, SupplierPrice.supplier_id == supplier_id
            )
        )
    )


@router.put("/suppliers/{supplier_id}/prices", response_model=SupplierPriceOut)
def upsert_supplier_price(
    supplier_id: str,
    body: SupplierPriceIn,
    user: User = Depends(require_roles(*CATALOG_ROLES)),
    db: Session = Depends(get_db),
) -> SupplierPrice:
    supplier = db.scalar(
        select(Supplier).where(Supplier.id == supplier_id, Supplier.tenant_id == user.tenant_id)
    )
    if supplier is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
    _product(db, user.tenant_id, body.product_id)
    row = db.scalar(
        select(SupplierPrice).where(
            SupplierPrice.supplier_id == supplier_id,
            SupplierPrice.product_id == body.product_id,
        )
    )
    if row is None:
        row = SupplierPrice(
            tenant_id=user.tenant_id,
            supplier_id=supplier_id,
            product_id=body.product_id,
            unit_cost=body.unit_cost,
        )
        db.add(row)
    else:
        row.unit_cost = body.unit_cost
    db.commit()
    db.refresh(row)
    return row
