from datetime import UTC, datetime
from decimal import Decimal
from secrets import token_hex

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import MANAGE_ROLES, get_current_user, require_roles
from app.core.db import get_db
from app.models.branch import Branch
from app.models.parked_bill import ParkedBill
from app.models.product import Product
from app.models.sale import Sale, SaleLine, SalePayment
from app.models.shift import Shift
from app.models.user import User
from app.schemas.pos import (
    CheckoutRequest,
    ParkBillRequest,
    ParkedBillOut,
    ProductCreate,
    ProductOut,
    ProductUpdate,
    ReturnLine,
    ReturnRequest,
    SaleOut,
    ShiftClose,
    ShiftOpen,
    ShiftOut,
)

POS_ROLES = ("owner", "manager", "cashier")
CATALOG_ROLES = ("owner", "manager", "stock_keeper")

router = APIRouter(tags=["pos"])


def _blank(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


def _ensure_unique_codes(
    db: Session,
    tenant_id: str,
    sku: str | None,
    barcode: str | None,
    *,
    exclude_id: str | None = None,
) -> None:
    if sku:
        query = select(Product.id).where(Product.tenant_id == tenant_id, Product.sku == sku)
        if exclude_id:
            query = query.where(Product.id != exclude_id)
        if db.scalar(query):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="SKU already exists")
    if barcode:
        query = select(Product.id).where(Product.tenant_id == tenant_id, Product.barcode == barcode)
        if exclude_id:
            query = query.where(Product.id != exclude_id)
        if db.scalar(query):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Barcode already exists")


def _branch_for_tenant(db: Session, tenant_id: str, branch_id: str | None) -> Branch | None:
    if not branch_id:
        return None
    branch = db.scalar(select(Branch).where(Branch.id == branch_id, Branch.tenant_id == tenant_id))
    if branch is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Branch not found")
    return branch


def _receipt_number(prefix: str = "R") -> str:
    return f"{prefix}{token_hex(4).upper()}"


def _open_shift(db: Session, user: User, branch_id: str | None) -> Shift | None:
    query = select(Shift).where(
        Shift.tenant_id == user.tenant_id,
        Shift.status == "open",
        Shift.opened_by_user_id == user.id,
    )
    if branch_id:
        query = query.where(Shift.branch_id == branch_id)
    return db.scalar(query.order_by(Shift.opened_at.desc()))


def _shift_out(shift: Shift) -> ShiftOut:
    variance = None
    if shift.closing_cash is not None and shift.expected_cash is not None:
        variance = (shift.closing_cash - shift.expected_cash).quantize(Decimal("0.01"))
    return ShiftOut(
        id=shift.id,
        branch_id=shift.branch_id,
        opened_by_user_id=shift.opened_by_user_id,
        closed_by_user_id=shift.closed_by_user_id,
        opening_cash=shift.opening_cash,
        closing_cash=shift.closing_cash,
        expected_cash=shift.expected_cash,
        cash_sales_total=shift.cash_sales_total,
        card_sales_total=shift.card_sales_total,
        credit_sales_total=shift.credit_sales_total,
        status=shift.status,
        opened_at=shift.opened_at,
        closed_at=shift.closed_at,
        note=shift.note,
        variance=variance,
    )


def _load_sale(db: Session, tenant_id: str, sale_id: str) -> Sale:
    sale = db.scalar(
        select(Sale)
        .options(joinedload(Sale.lines), joinedload(Sale.payments))
        .where(Sale.id == sale_id, Sale.tenant_id == tenant_id)
    )
    if sale is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sale not found")
    return sale


@router.get("/products", response_model=list[ProductOut])
def list_products(
    active_only: bool = True,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Product]:
    query = select(Product).where(Product.tenant_id == user.tenant_id)
    if active_only:
        query = query.where(Product.is_active.is_(True))
    return list(db.scalars(query.order_by(Product.name)))


@router.post("/products", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(
    body: ProductCreate,
    user: User = Depends(require_roles(*CATALOG_ROLES)),
    db: Session = Depends(get_db),
) -> Product:
    sku = _blank(body.sku)
    barcode = _blank(body.barcode)
    _ensure_unique_codes(db, user.tenant_id, sku, barcode)
    product = Product(
        tenant_id=user.tenant_id,
        name=body.name.strip(),
        sku=sku,
        barcode=barcode,
        unit_price=body.unit_price,
        stock_on_hand=body.stock_on_hand,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.patch("/products/{product_id}", response_model=ProductOut)
def update_product(
    product_id: str,
    body: ProductUpdate,
    user: User = Depends(require_roles(*CATALOG_ROLES)),
    db: Session = Depends(get_db),
) -> Product:
    product = db.scalar(
        select(Product).where(Product.id == product_id, Product.tenant_id == user.tenant_id)
    )
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    data = body.model_dump(exclude_unset=True)
    if "sku" in data:
        data["sku"] = _blank(data["sku"])
    if "barcode" in data:
        data["barcode"] = _blank(data["barcode"])
    if "name" in data and isinstance(data["name"], str):
        data["name"] = data["name"].strip()
    _ensure_unique_codes(
        db,
        user.tenant_id,
        data.get("sku", product.sku),
        data.get("barcode", product.barcode),
        exclude_id=product.id,
    )
    for key, value in data.items():
        setattr(product, key, value)
    db.commit()
    db.refresh(product)
    return product


@router.get("/pos/shifts/current", response_model=ShiftOut | None)
def current_shift(
    branch_id: str | None = None,
    user: User = Depends(require_roles(*POS_ROLES)),
    db: Session = Depends(get_db),
) -> ShiftOut | None:
    shift = _open_shift(db, user, branch_id or user.branch_id)
    return _shift_out(shift) if shift else None


@router.post("/pos/shifts/open", response_model=ShiftOut, status_code=status.HTTP_201_CREATED)
def open_shift(
    body: ShiftOpen,
    user: User = Depends(require_roles(*POS_ROLES)),
    db: Session = Depends(get_db),
) -> ShiftOut:
    branch_id = body.branch_id or user.branch_id
    branch = _branch_for_tenant(db, user.tenant_id, branch_id)
    if _open_shift(db, user, branch.id if branch else None):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="You already have an open shift")
    shift = Shift(
        tenant_id=user.tenant_id,
        branch_id=branch.id if branch else None,
        opened_by_user_id=user.id,
        opening_cash=body.opening_cash,
    )
    db.add(shift)
    db.commit()
    db.refresh(shift)
    return _shift_out(shift)


@router.post("/pos/shifts/{shift_id}/close", response_model=ShiftOut)
def close_shift(
    shift_id: str,
    body: ShiftClose,
    user: User = Depends(require_roles(*POS_ROLES)),
    db: Session = Depends(get_db),
) -> ShiftOut:
    shift = db.scalar(
        select(Shift).where(Shift.id == shift_id, Shift.tenant_id == user.tenant_id, Shift.status == "open")
    )
    if shift is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Open shift not found")
    if shift.opened_by_user_id != user.id and user.role not in MANAGE_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your shift")
    expected = (shift.opening_cash + shift.cash_sales_total).quantize(Decimal("0.01"))
    shift.closing_cash = body.closing_cash
    shift.expected_cash = expected
    shift.closed_by_user_id = user.id
    shift.closed_at = datetime.now(UTC)
    shift.status = "closed"
    shift.note = _blank(body.note)
    db.commit()
    db.refresh(shift)
    return _shift_out(shift)


@router.get("/pos/parked", response_model=list[ParkedBillOut])
def list_parked(
    user: User = Depends(require_roles(*POS_ROLES)),
    db: Session = Depends(get_db),
) -> list[ParkedBill]:
    return list(
        db.scalars(
            select(ParkedBill)
            .where(ParkedBill.tenant_id == user.tenant_id)
            .order_by(ParkedBill.created_at.desc())
        )
    )


@router.post("/pos/park", response_model=ParkedBillOut, status_code=status.HTTP_201_CREATED)
def park_bill(
    body: ParkBillRequest,
    user: User = Depends(require_roles(*POS_ROLES)),
    db: Session = Depends(get_db),
) -> ParkedBill:
    branch_id = body.branch_id or user.branch_id
    branch = _branch_for_tenant(db, user.tenant_id, branch_id)
    product_ids = [line.product_id for line in body.lines]
    found = list(
        db.scalars(
            select(Product.id).where(
                Product.tenant_id == user.tenant_id,
                Product.id.in_(product_ids),
                Product.is_active.is_(True),
            )
        )
    )
    if len(set(found)) != len(set(product_ids)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="One or more products are invalid")

    parked = ParkedBill(
        tenant_id=user.tenant_id,
        branch_id=branch.id if branch else None,
        cashier_user_id=user.id,
        label=body.label.strip() or "Held",
        cart_json={
            "discount_total": str(body.discount_total),
            "note": body.note,
            "lines": [{"product_id": line.product_id, "quantity": str(line.quantity)} for line in body.lines],
        },
    )
    db.add(parked)
    db.commit()
    db.refresh(parked)
    return parked


@router.delete("/pos/parked/{parked_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_parked(
    parked_id: str,
    user: User = Depends(require_roles(*POS_ROLES)),
    db: Session = Depends(get_db),
) -> Response:
    parked = db.scalar(
        select(ParkedBill).where(ParkedBill.id == parked_id, ParkedBill.tenant_id == user.tenant_id)
    )
    if parked is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parked bill not found")
    db.delete(parked)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.get("/sales", response_model=list[SaleOut])
def list_sales(
    user: User = Depends(require_roles(*POS_ROLES)),
    db: Session = Depends(get_db),
) -> list[Sale]:
    return list(
        db.scalars(
            select(Sale)
            .options(joinedload(Sale.lines), joinedload(Sale.payments))
            .where(Sale.tenant_id == user.tenant_id)
            .order_by(Sale.created_at.desc())
            .limit(50)
        ).unique()
    )


@router.get("/sales/{sale_id}", response_model=SaleOut)
def get_sale(
    sale_id: str,
    user: User = Depends(require_roles(*POS_ROLES)),
    db: Session = Depends(get_db),
) -> Sale:
    return _load_sale(db, user.tenant_id, sale_id)


@router.post("/pos/checkout", response_model=SaleOut, status_code=status.HTTP_201_CREATED)
def checkout(
    body: CheckoutRequest,
    user: User = Depends(require_roles(*POS_ROLES)),
    db: Session = Depends(get_db),
) -> Sale:
    branch_id = body.branch_id or user.branch_id
    branch = _branch_for_tenant(db, user.tenant_id, branch_id)
    shift = _open_shift(db, user, branch.id if branch else None)
    if shift is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Open a shift before checkout",
        )

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

    sale_lines: list[SaleLine] = []
    subtotal = Decimal("0")
    for line in body.lines:
        product = by_id[line.product_id]
        if product.stock_on_hand < line.quantity:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Not enough stock for {product.name}",
            )
        line_total = (product.unit_price * line.quantity).quantize(Decimal("0.01"))
        subtotal += line_total
        sale_lines.append(
            SaleLine(
                product_id=product.id,
                product_name=product.name,
                quantity=line.quantity,
                unit_price=product.unit_price,
                line_total=line_total,
            )
        )
        product.stock_on_hand = product.stock_on_hand - line.quantity

    discount = body.discount_total
    if discount > subtotal:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Discount exceeds subtotal")
    total = (subtotal - discount).quantize(Decimal("0.01"))
    paid = sum((payment.amount for payment in body.payments), Decimal("0")).quantize(Decimal("0.01"))
    if paid != total:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payments must total {total}",
        )

    for payment in body.payments:
        if payment.method == "cash":
            shift.cash_sales_total = (shift.cash_sales_total + payment.amount).quantize(Decimal("0.01"))
        elif payment.method == "card":
            shift.card_sales_total = (shift.card_sales_total + payment.amount).quantize(Decimal("0.01"))
        else:
            shift.credit_sales_total = (shift.credit_sales_total + payment.amount).quantize(Decimal("0.01"))

    sale = Sale(
        tenant_id=user.tenant_id,
        branch_id=branch.id if branch else None,
        cashier_user_id=user.id,
        shift_id=shift.id,
        receipt_number=_receipt_number(),
        status="completed",
        subtotal=subtotal.quantize(Decimal("0.01")),
        discount_total=discount,
        total=total,
        note=_blank(body.note),
        lines=sale_lines,
        payments=[SalePayment(method=p.method, amount=p.amount) for p in body.payments],
    )
    db.add(sale)
    if body.parked_bill_id:
        parked = db.scalar(
            select(ParkedBill).where(
                ParkedBill.id == body.parked_bill_id,
                ParkedBill.tenant_id == user.tenant_id,
            )
        )
        if parked:
            db.delete(parked)
    db.commit()
    return _load_sale(db, user.tenant_id, sale.id)


@router.post("/sales/{sale_id}/void", response_model=SaleOut)
def void_sale(
    sale_id: str,
    user: User = Depends(require_roles(*MANAGE_ROLES)),
    db: Session = Depends(get_db),
) -> Sale:
    sale = _load_sale(db, user.tenant_id, sale_id)
    if sale.status != "completed":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only completed sales can be voided")
    if sale.refund_of_sale_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot void a return receipt")

    for line in sale.lines:
        if line.product_id:
            product = db.scalar(
                select(Product).where(Product.id == line.product_id, Product.tenant_id == user.tenant_id)
            )
            if product:
                product.stock_on_hand = product.stock_on_hand + line.quantity

    if sale.shift_id:
        shift = db.scalar(select(Shift).where(Shift.id == sale.shift_id, Shift.tenant_id == user.tenant_id))
        if shift and shift.status == "open":
            for payment in sale.payments:
                if payment.method == "cash":
                    shift.cash_sales_total = (shift.cash_sales_total - payment.amount).quantize(Decimal("0.01"))
                elif payment.method == "card":
                    shift.card_sales_total = (shift.card_sales_total - payment.amount).quantize(Decimal("0.01"))
                else:
                    shift.credit_sales_total = (shift.credit_sales_total - payment.amount).quantize(Decimal("0.01"))

    sale.status = "voided"
    db.commit()
    return _load_sale(db, user.tenant_id, sale.id)


@router.post("/sales/{sale_id}/return", response_model=SaleOut, status_code=status.HTTP_201_CREATED)
def return_sale(
    sale_id: str,
    body: ReturnRequest,
    user: User = Depends(require_roles(*POS_ROLES)),
    db: Session = Depends(get_db),
) -> Sale:
    original = _load_sale(db, user.tenant_id, sale_id)
    if original.status != "completed":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only completed sales can be returned")
    if original.refund_of_sale_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot return a return receipt")
    already = db.scalar(
        select(Sale.id).where(
            Sale.tenant_id == user.tenant_id,
            Sale.refund_of_sale_id == original.id,
            Sale.status == "returned",
        )
    )
    if already:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sale already has a return")

    line_by_id = {line.id: line for line in original.lines}
    selections: list[ReturnLine] = body.lines or [
        ReturnLine(sale_line_id=line.id, quantity=line.quantity) for line in original.lines
    ]

    return_lines: list[SaleLine] = []
    subtotal = Decimal("0")
    for selection in selections:
        source = line_by_id.get(selection.sale_line_id)
        if source is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid sale line")
        if selection.quantity > source.quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Return qty exceeds sold qty for {source.product_name}",
            )
        line_total = (source.unit_price * selection.quantity).quantize(Decimal("0.01"))
        subtotal += line_total
        return_lines.append(
            SaleLine(
                product_id=source.product_id,
                product_name=source.product_name,
                quantity=selection.quantity,
                unit_price=source.unit_price,
                line_total=line_total,
            )
        )
        if body.restock and source.product_id:
            product = db.scalar(
                select(Product).where(Product.id == source.product_id, Product.tenant_id == user.tenant_id)
            )
            if product:
                product.stock_on_hand = product.stock_on_hand + selection.quantity

    total = subtotal.quantize(Decimal("0.01"))
    if original.shift_id:
        shift = db.scalar(select(Shift).where(Shift.id == original.shift_id, Shift.tenant_id == user.tenant_id))
        if shift and shift.status == "open":
            shift.cash_sales_total = (shift.cash_sales_total - total).quantize(Decimal("0.01"))

    refund = Sale(
        tenant_id=user.tenant_id,
        branch_id=original.branch_id,
        cashier_user_id=user.id,
        shift_id=original.shift_id,
        refund_of_sale_id=original.id,
        receipt_number=_receipt_number("X"),
        status="returned",
        subtotal=total,
        discount_total=Decimal("0"),
        total=total,
        note=_blank(body.note) or f"Return of {original.receipt_number}",
        lines=return_lines,
        payments=[SalePayment(method="cash", amount=total)],
    )
    db.add(refund)
    db.commit()
    return _load_sale(db, user.tenant_id, refund.id)
