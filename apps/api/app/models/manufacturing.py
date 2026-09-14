from datetime import UTC, datetime
from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.types import GUID

if TYPE_CHECKING:
    from app.models.product import Product
    from app.models.tenant import Tenant
    from app.models.user import User


class Bom(Base):
    __tablename__ = "boms"

    id: Mapped[str] = mapped_column(GUID(), primary_key=True, default=lambda: str(uuid4()))
    tenant_id: Mapped[str] = mapped_column(GUID(), ForeignKey("tenants.id", ondelete="CASCADE"))
    finished_product_id: Mapped[str] = mapped_column(GUID(), ForeignKey("products.id", ondelete="RESTRICT"))
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    expected_yield_pct: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False, default=Decimal("100"))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), default=lambda: datetime.now(UTC)
    )

    tenant: Mapped["Tenant"] = relationship()
    finished_product: Mapped["Product"] = relationship()
    lines: Mapped[list["BomLine"]] = relationship(back_populates="bom", cascade="all, delete-orphan")


class BomLine(Base):
    __tablename__ = "bom_lines"
    __table_args__ = (UniqueConstraint("bom_id", "component_product_id"),)

    id: Mapped[str] = mapped_column(GUID(), primary_key=True, default=lambda: str(uuid4()))
    bom_id: Mapped[str] = mapped_column(GUID(), ForeignKey("boms.id", ondelete="CASCADE"))
    component_product_id: Mapped[str] = mapped_column(GUID(), ForeignKey("products.id", ondelete="RESTRICT"))
    quantity_per_output: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)

    bom: Mapped["Bom"] = relationship(back_populates="lines")
    component_product: Mapped["Product"] = relationship()


class ProductionRun(Base):
    __tablename__ = "production_runs"

    id: Mapped[str] = mapped_column(GUID(), primary_key=True, default=lambda: str(uuid4()))
    tenant_id: Mapped[str] = mapped_column(GUID(), ForeignKey("tenants.id", ondelete="CASCADE"))
    bom_id: Mapped[str] = mapped_column(GUID(), ForeignKey("boms.id", ondelete="RESTRICT"))
    finished_product_id: Mapped[str] = mapped_column(GUID(), ForeignKey("products.id", ondelete="RESTRICT"))
    planned_output_qty: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    actual_output_qty: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    yield_pct: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    wastage_pct: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False, default=Decimal("0"))
    total_component_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"))
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="completed")
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_user_id: Mapped[str] = mapped_column(GUID(), ForeignKey("users.id", ondelete="RESTRICT"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), default=lambda: datetime.now(UTC)
    )

    tenant: Mapped["Tenant"] = relationship()
    bom: Mapped["Bom"] = relationship()
    finished_product: Mapped["Product"] = relationship()
    created_by: Mapped["User"] = relationship()
    lines: Mapped[list["ProductionRunLine"]] = relationship(
        back_populates="run", cascade="all, delete-orphan"
    )


class ProductionRunLine(Base):
    __tablename__ = "production_run_lines"

    id: Mapped[str] = mapped_column(GUID(), primary_key=True, default=lambda: str(uuid4()))
    run_id: Mapped[str] = mapped_column(GUID(), ForeignKey("production_runs.id", ondelete="CASCADE"))
    component_product_id: Mapped[str] = mapped_column(GUID(), ForeignKey("products.id", ondelete="RESTRICT"))
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"))
    line_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"))

    run: Mapped["ProductionRun"] = relationship(back_populates="lines")
    component_product: Mapped["Product"] = relationship()
