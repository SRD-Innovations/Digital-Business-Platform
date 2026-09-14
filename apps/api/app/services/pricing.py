from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.product import Product
from app.models.trade import PriceTier, ProductBatch


def resolve_unit_price(db: Session, product: Product, quantity: Decimal) -> Decimal:
    tiers = list(
        db.scalars(
            select(PriceTier)
            .where(PriceTier.product_id == product.id, PriceTier.min_qty <= quantity)
            .order_by(PriceTier.min_qty.desc())
        )
    )
    if tiers:
        return tiers[0].unit_price
    return product.unit_price


def allocate_batches_fefo(
    db: Session,
    *,
    product: Product,
    quantity: Decimal,
) -> list[tuple[ProductBatch, Decimal]]:
    """Take quantity from earliest-expiring batches. Caller must also adjust product.stock_on_hand."""
    if not product.track_batches:
        return []

    batches = list(
        db.scalars(
            select(ProductBatch)
            .where(ProductBatch.product_id == product.id, ProductBatch.quantity > 0)
            .order_by(ProductBatch.expiry_date.asc().nulls_last(), ProductBatch.created_at.asc())
        )
    )
    remaining = quantity
    allocated: list[tuple[ProductBatch, Decimal]] = []
    for batch in batches:
        if remaining <= 0:
            break
        take = min(batch.quantity, remaining)
        batch.quantity = (batch.quantity - take).quantize(Decimal("0.001"))
        allocated.append((batch, take))
        remaining = (remaining - take).quantize(Decimal("0.001"))
    if remaining > 0:
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Not enough batch stock for {product.name}",
        )
    return allocated


def add_to_batch(
    db: Session,
    *,
    product: Product,
    batch_code: str,
    quantity: Decimal,
    expiry_date,
    tenant_id: str,
) -> ProductBatch:
    batch = db.scalar(
        select(ProductBatch).where(
            ProductBatch.product_id == product.id,
            ProductBatch.batch_code == batch_code,
        )
    )
    if batch is None:
        batch = ProductBatch(
            tenant_id=tenant_id,
            product_id=product.id,
            batch_code=batch_code,
            expiry_date=expiry_date,
            quantity=Decimal("0"),
        )
        db.add(batch)
        db.flush()
    elif expiry_date is not None:
        batch.expiry_date = expiry_date
    batch.quantity = (batch.quantity + quantity).quantize(Decimal("0.001"))
    return batch
