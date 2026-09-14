from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.inventory_movement import InventoryMovement
from app.models.product import Product


def apply_stock_change(
    db: Session,
    *,
    product: Product,
    quantity_delta: Decimal,
    reason: str,
    user_id: str | None = None,
    ref_type: str | None = None,
    ref_id: str | None = None,
    note: str | None = None,
    allow_negative: bool = False,
) -> InventoryMovement:
    """Adjust product.stock_on_hand and append an inventory movement in the same unit of work."""
    if quantity_delta == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Quantity change cannot be zero")

    next_qty = (product.stock_on_hand + quantity_delta).quantize(Decimal("0.001"))
    if not allow_negative and next_qty < 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Not enough stock for {product.name}",
        )

    product.stock_on_hand = next_qty
    movement = InventoryMovement(
        tenant_id=product.tenant_id,
        product_id=product.id,
        quantity=quantity_delta.quantize(Decimal("0.001")),
        reason=reason,
        ref_type=ref_type,
        ref_id=ref_id,
        note=note,
        created_by_user_id=user_id,
    )
    db.add(movement)
    return movement
