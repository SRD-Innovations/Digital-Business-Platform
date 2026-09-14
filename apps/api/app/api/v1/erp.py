from datetime import date, datetime, time
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import require_roles
from app.core.db import get_db
from app.models.branch import Branch
from app.models.inventory_movement import InventoryMovement
from app.models.product import Product
from app.models.purchase import PurchaseReceipt, PurchaseReceiptLine
from app.models.sale import Sale, SaleLine, SalePayment
from app.models.supplier import Supplier
from app.models.user import User
from app.schemas.erp import (
    InventoryMovementOut,
    PurchaseReceiveRequest,
    PurchaseReceiptOut,
    SalesReportOut,
    SalesReportDay,
    SalesReportPayment,
    SalesReportProduct,
    StockAdjustmentRequest,
    SupplierCreate,
    SupplierOut,
    SupplierUpdate,
)
from app.services.inventory import apply_stock_change

INVENTORY_ROLES = ("owner", "manager", "stock_keeper")
REPORT_ROLES = ("owner", "manager", "accountant")
READ_INVENTORY_ROLES = ("owner", "manager", "stock_keeper", "accountant")

router = APIRouter(tags=["erp"])


def _blank(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


def _branch_for_tenant(db: Session, tenant_id: str, branch_id: str | None) -> Branch | None:
    if not branch_id:
        return None
    branch = db.scalar(select(Branch).where(Branch.id == branch_id, Branch.tenant_id == tenant_id))
    if branch is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Branch not found")
    return branch


def _load_receipt(db: Session, tenant_id: str, receipt_id: str) -> PurchaseReceipt:
    receipt = db.scalar(
        select(PurchaseReceipt)
        .options(joinedload(PurchaseReceipt.lines))
        .where(PurchaseReceipt.id == receipt_id, PurchaseReceipt.tenant_id == tenant_id)
    )
    if receipt is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Receipt not found")
    return receipt


@router.get("/suppliers", response_model=list[SupplierOut])
def list_suppliers(
    active_only: bool = True,
    user: User = Depends(require_roles(*READ_INVENTORY_ROLES)),
    db: Session = Depends(get_db),
) -> list[Supplier]:
    stmt = select(Supplier).where(Supplier.tenant_id == user.tenant_id).order_by(Supplier.name)
    if active_only:
        stmt = stmt.where(Supplier.is_active.is_(True))
    return list(db.scalars(stmt))


@router.post("/suppliers", response_model=SupplierOut, status_code=status.HTTP_201_CREATED)
def create_supplier(
    body: SupplierCreate,
    user: User = Depends(require_roles(*INVENTORY_ROLES)),
    db: Session = Depends(get_db),
) -> Supplier:
    supplier = Supplier(
        tenant_id=user.tenant_id,
        name=body.name,
        phone=_blank(body.phone),
        email=_blank(body.email),
        note=_blank(body.note),
    )
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return supplier


@router.patch("/suppliers/{supplier_id}", response_model=SupplierOut)
def update_supplier(
    supplier_id: str,
    body: SupplierUpdate,
    user: User = Depends(require_roles(*INVENTORY_ROLES)),
    db: Session = Depends(get_db),
) -> Supplier:
    supplier = db.scalar(
        select(Supplier).where(Supplier.id == supplier_id, Supplier.tenant_id == user.tenant_id)
    )
    if supplier is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
    if body.name is not None:
        supplier.name = body.name
    if body.phone is not None:
        supplier.phone = _blank(body.phone)
    if body.email is not None:
        supplier.email = _blank(body.email)
    if body.note is not None:
        supplier.note = _blank(body.note)
    if body.is_active is not None:
        supplier.is_active = body.is_active
    db.commit()
    db.refresh(supplier)
    return supplier


@router.get("/purchases/receipts", response_model=list[PurchaseReceiptOut])
def list_receipts(
    user: User = Depends(require_roles(*READ_INVENTORY_ROLES)),
    db: Session = Depends(get_db),
) -> list[PurchaseReceipt]:
    return list(
        db.scalars(
            select(PurchaseReceipt)
            .options(joinedload(PurchaseReceipt.lines))
            .where(PurchaseReceipt.tenant_id == user.tenant_id)
            .order_by(PurchaseReceipt.received_at.desc())
            .limit(50)
        ).unique()
    )


@router.post("/purchases/receive", response_model=PurchaseReceiptOut, status_code=status.HTTP_201_CREATED)
def receive_purchase(
    body: PurchaseReceiveRequest,
    user: User = Depends(require_roles(*INVENTORY_ROLES)),
    db: Session = Depends(get_db),
) -> PurchaseReceipt:
    supplier = db.scalar(
        select(Supplier).where(
            Supplier.id == body.supplier_id,
            Supplier.tenant_id == user.tenant_id,
            Supplier.is_active.is_(True),
        )
    )
    if supplier is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Supplier not found")
    branch = _branch_for_tenant(db, user.tenant_id, body.branch_id or user.branch_id)

    product_ids = [line.product_id for line in body.lines]
    products = list(
        db.scalars(
            select(Product).where(
                Product.tenant_id == user.tenant_id,
                Product.id.in_(product_ids),
                Product.is_active.is_(True),
            )
        )
    )
    by_id = {product.id: product for product in products}
    if len(by_id) != len(set(product_ids)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="One or more products are invalid")

    receipt = PurchaseReceipt(
        tenant_id=user.tenant_id,
        supplier_id=supplier.id,
        branch_id=branch.id if branch else None,
        received_by_user_id=user.id,
        note=_blank(body.note),
        lines=[
            PurchaseReceiptLine(
                product_id=line.product_id,
                quantity=line.quantity,
                unit_cost=line.unit_cost,
            )
            for line in body.lines
        ],
    )
    db.add(receipt)
    db.flush()

    for line in body.lines:
        apply_stock_change(
            db,
            product=by_id[line.product_id],
            quantity_delta=line.quantity,
            reason="purchase_receive",
            user_id=user.id,
            ref_type="purchase_receipt",
            ref_id=receipt.id,
        )

    db.commit()
    return _load_receipt(db, user.tenant_id, receipt.id)


@router.get("/inventory/movements", response_model=list[InventoryMovementOut])
def list_movements(
    product_id: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    user: User = Depends(require_roles(*READ_INVENTORY_ROLES)),
    db: Session = Depends(get_db),
) -> list[InventoryMovement]:
    stmt = (
        select(InventoryMovement)
        .where(InventoryMovement.tenant_id == user.tenant_id)
        .order_by(InventoryMovement.created_at.desc())
        .limit(limit)
    )
    if product_id:
        stmt = stmt.where(InventoryMovement.product_id == product_id)
    return list(db.scalars(stmt))


@router.post("/inventory/adjustments", response_model=InventoryMovementOut, status_code=status.HTTP_201_CREATED)
def adjust_stock(
    body: StockAdjustmentRequest,
    user: User = Depends(require_roles(*INVENTORY_ROLES)),
    db: Session = Depends(get_db),
) -> InventoryMovement:
    product = db.scalar(
        select(Product).where(Product.id == body.product_id, Product.tenant_id == user.tenant_id)
    )
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    movement = apply_stock_change(
        db,
        product=product,
        quantity_delta=body.quantity_delta,
        reason="adjustment",
        user_id=user.id,
        note=_blank(body.note),
    )
    db.commit()
    db.refresh(movement)
    return movement


@router.get("/reports/sales", response_model=SalesReportOut)
def sales_report(
    from_date: date | None = None,
    to_date: date | None = None,
    user: User = Depends(require_roles(*REPORT_ROLES)),
    db: Session = Depends(get_db),
) -> SalesReportOut:
    stmt = select(Sale).where(Sale.tenant_id == user.tenant_id, Sale.status == "completed")
    if from_date:
        stmt = stmt.where(Sale.created_at >= datetime.combine(from_date, time.min))
    if to_date:
        stmt = stmt.where(Sale.created_at <= datetime.combine(to_date, time.max))

    sales = list(db.scalars(stmt.options(joinedload(Sale.lines), joinedload(Sale.payments))).unique())
    gross = sum((sale.total for sale in sales), Decimal("0")).quantize(Decimal("0.01"))

    by_day_map: dict[str, list[Decimal | int]] = {}
    for sale in sales:
        day = sale.created_at.date().isoformat()
        bucket = by_day_map.setdefault(day, [0, Decimal("0")])
        bucket[0] = int(bucket[0]) + 1
        bucket[1] = Decimal(bucket[1]) + sale.total

    product_map: dict[str, SalesReportProduct] = {}
    for sale in sales:
        for line in sale.lines:
            key = line.product_id or line.product_name
            existing = product_map.get(key)
            if existing is None:
                product_map[key] = SalesReportProduct(
                    product_id=line.product_id,
                    product_name=line.product_name,
                    quantity=line.quantity,
                    revenue=line.line_total,
                )
            else:
                existing.quantity = (existing.quantity + line.quantity).quantize(Decimal("0.001"))
                existing.revenue = (existing.revenue + line.line_total).quantize(Decimal("0.01"))

    pay_map: dict[str, Decimal] = {}
    for sale in sales:
        for payment in sale.payments:
            pay_map[payment.method] = (pay_map.get(payment.method, Decimal("0")) + payment.amount).quantize(
                Decimal("0.01")
            )

    top = sorted(product_map.values(), key=lambda row: row.revenue, reverse=True)[:10]
    return SalesReportOut(
        from_date=from_date.isoformat() if from_date else None,
        to_date=to_date.isoformat() if to_date else None,
        completed_sales=len(sales),
        gross_total=gross,
        by_day=[
            SalesReportDay(day=day, sale_count=int(vals[0]), total=Decimal(vals[1]).quantize(Decimal("0.01")))
            for day, vals in sorted(by_day_map.items())
        ],
        top_products=top,
        by_payment=[SalesReportPayment(method=method, amount=amount) for method, amount in sorted(pay_map.items())],
    )
