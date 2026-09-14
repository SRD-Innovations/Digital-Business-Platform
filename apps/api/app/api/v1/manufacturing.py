from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import require_roles
from app.core.db import get_db
from app.models.manufacturing import Bom, BomLine, ProductionRun, ProductionRunLine
from app.models.product import Product
from app.models.user import User
from app.schemas.manufacturing import BomCreate, BomOut, ProductionRunCreate, ProductionRunOut
from app.services.inventory import apply_stock_change

MFG_ROLES = ("owner", "manager", "production_staff", "stock_keeper")
READ_ROLES = ("owner", "manager", "production_staff", "stock_keeper", "accountant")

router = APIRouter(tags=["manufacturing"])


def _blank(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


def _load_bom(db: Session, tenant_id: str, bom_id: str) -> Bom:
    bom = db.scalar(
        select(Bom)
        .options(joinedload(Bom.lines))
        .where(Bom.id == bom_id, Bom.tenant_id == tenant_id)
    )
    if bom is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="BOM not found")
    return bom


def _load_run(db: Session, tenant_id: str, run_id: str) -> ProductionRun:
    run = db.scalar(
        select(ProductionRun)
        .options(joinedload(ProductionRun.lines))
        .where(ProductionRun.id == run_id, ProductionRun.tenant_id == tenant_id)
    )
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Production run not found")
    return run


@router.get("/boms", response_model=list[BomOut])
def list_boms(
    active_only: bool = True,
    user: User = Depends(require_roles(*READ_ROLES)),
    db: Session = Depends(get_db),
) -> list[Bom]:
    stmt = (
        select(Bom)
        .options(joinedload(Bom.lines))
        .where(Bom.tenant_id == user.tenant_id)
        .order_by(Bom.name)
    )
    if active_only:
        stmt = stmt.where(Bom.is_active.is_(True))
    return list(db.scalars(stmt).unique())


@router.post("/boms", response_model=BomOut, status_code=status.HTTP_201_CREATED)
def create_bom(
    body: BomCreate,
    user: User = Depends(require_roles(*MFG_ROLES)),
    db: Session = Depends(get_db),
) -> Bom:
    finished = db.scalar(
        select(Product).where(
            Product.id == body.finished_product_id,
            Product.tenant_id == user.tenant_id,
            Product.is_active.is_(True),
        )
    )
    if finished is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Finished product not found")

    component_ids = [line.component_product_id for line in body.lines]
    components = list(
        db.scalars(
            select(Product).where(
                Product.tenant_id == user.tenant_id,
                Product.id.in_(component_ids),
                Product.is_active.is_(True),
            )
        )
    )
    if len(components) != len(set(component_ids)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="One or more components are invalid")

    bom = Bom(
        tenant_id=user.tenant_id,
        finished_product_id=finished.id,
        name=body.name,
        expected_yield_pct=body.expected_yield_pct,
        lines=[
            BomLine(
                component_product_id=line.component_product_id,
                quantity_per_output=line.quantity_per_output,
            )
            for line in body.lines
        ],
    )
    db.add(bom)
    db.commit()
    return _load_bom(db, user.tenant_id, bom.id)


@router.get("/production/runs", response_model=list[ProductionRunOut])
def list_runs(
    user: User = Depends(require_roles(*READ_ROLES)),
    db: Session = Depends(get_db),
) -> list[ProductionRun]:
    return list(
        db.scalars(
            select(ProductionRun)
            .options(joinedload(ProductionRun.lines))
            .where(ProductionRun.tenant_id == user.tenant_id)
            .order_by(ProductionRun.created_at.desc())
            .limit(50)
        ).unique()
    )


@router.post("/production/runs", response_model=ProductionRunOut, status_code=status.HTTP_201_CREATED)
def create_production_run(
    body: ProductionRunCreate,
    user: User = Depends(require_roles(*MFG_ROLES)),
    db: Session = Depends(get_db),
) -> ProductionRun:
    bom = _load_bom(db, user.tenant_id, body.bom_id)
    if not bom.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="BOM is inactive")
    if not bom.lines:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="BOM has no lines")

    finished = db.scalar(
        select(Product).where(
            Product.id == bom.finished_product_id,
            Product.tenant_id == user.tenant_id,
        )
    )
    if finished is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Finished product missing")

    # Consume materials for the planned batch (scaled by expected yield).
    yield_factor = (bom.expected_yield_pct / Decimal("100")).quantize(Decimal("0.0001"))
    if yield_factor <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid expected yield")

    component_ids = [line.component_product_id for line in bom.lines]
    components = {
        product.id: product
        for product in db.scalars(
            select(Product).where(Product.tenant_id == user.tenant_id, Product.id.in_(component_ids))
        )
    }

    run_lines: list[ProductionRunLine] = []
    total_cost = Decimal("0")
    for line in bom.lines:
        component = components.get(line.component_product_id)
        if component is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="BOM component missing")
        # qty needed to attempt planned output at expected yield
        qty = (line.quantity_per_output * body.planned_output_qty / yield_factor).quantize(Decimal("0.001"))
        unit_cost = component.unit_price
        line_cost = (unit_cost * qty).quantize(Decimal("0.01"))
        total_cost += line_cost
        run_lines.append(
            ProductionRunLine(
                component_product_id=component.id,
                quantity=qty,
                unit_cost=unit_cost,
                line_cost=line_cost,
            )
        )

    if body.planned_output_qty > 0:
        yield_pct = ((body.actual_output_qty / body.planned_output_qty) * Decimal("100")).quantize(
            Decimal("0.01")
        )
    else:
        yield_pct = Decimal("0")
    wastage_pct = (Decimal("100") - yield_pct).quantize(Decimal("0.01"))
    if wastage_pct < 0:
        wastage_pct = Decimal("0")

    unit_cost = Decimal("0")
    if body.actual_output_qty > 0:
        unit_cost = (total_cost / body.actual_output_qty).quantize(Decimal("0.0001"))

    run = ProductionRun(
        tenant_id=user.tenant_id,
        bom_id=bom.id,
        finished_product_id=finished.id,
        planned_output_qty=body.planned_output_qty,
        actual_output_qty=body.actual_output_qty,
        yield_pct=yield_pct,
        wastage_pct=wastage_pct,
        unit_cost=unit_cost,
        total_component_cost=total_cost.quantize(Decimal("0.01")),
        note=_blank(body.note),
        created_by_user_id=user.id,
        lines=run_lines,
    )
    db.add(run)
    db.flush()

    for line in run_lines:
        component = components[line.component_product_id]
        apply_stock_change(
            db,
            product=component,
            quantity_delta=-line.quantity,
            reason="manufacture_consume",
            user_id=user.id,
            ref_type="production_run",
            ref_id=run.id,
        )

    if body.actual_output_qty > 0:
        apply_stock_change(
            db,
            product=finished,
            quantity_delta=body.actual_output_qty,
            reason="manufacture_output",
            user_id=user.id,
            ref_type="production_run",
            ref_id=run.id,
        )

    db.commit()
    return _load_run(db, user.tenant_id, run.id)
