from datetime import UTC, date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import uuid4

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.types import GUID

if TYPE_CHECKING:
    from app.models.product import Product
    from app.models.supplier import Supplier
    from app.models.tenant import Tenant


class PriceTier(Base):
    __tablename__ = "product_price_tiers"
    __table_args__ = (UniqueConstraint("product_id", "min_qty"),)

    id: Mapped[str] = mapped_column(GUID(), primary_key=True, default=lambda: str(uuid4()))
    tenant_id: Mapped[str] = mapped_column(GUID(), ForeignKey("tenants.id", ondelete="CASCADE"))
    product_id: Mapped[str] = mapped_column(GUID(), ForeignKey("products.id", ondelete="CASCADE"))
    min_qty: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    tenant: Mapped["Tenant"] = relationship()
    product: Mapped["Product"] = relationship()


class SupplierPrice(Base):
    __tablename__ = "supplier_prices"
    __table_args__ = (UniqueConstraint("supplier_id", "product_id"),)

    id: Mapped[str] = mapped_column(GUID(), primary_key=True, default=lambda: str(uuid4()))
    tenant_id: Mapped[str] = mapped_column(GUID(), ForeignKey("tenants.id", ondelete="CASCADE"))
    supplier_id: Mapped[str] = mapped_column(GUID(), ForeignKey("suppliers.id", ondelete="CASCADE"))
    product_id: Mapped[str] = mapped_column(GUID(), ForeignKey("products.id", ondelete="CASCADE"))
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    tenant: Mapped["Tenant"] = relationship()
    supplier: Mapped["Supplier"] = relationship()
    product: Mapped["Product"] = relationship()


class ProductBatch(Base):
    __tablename__ = "product_batches"
    __table_args__ = (UniqueConstraint("product_id", "batch_code"),)

    id: Mapped[str] = mapped_column(GUID(), primary_key=True, default=lambda: str(uuid4()))
    tenant_id: Mapped[str] = mapped_column(GUID(), ForeignKey("tenants.id", ondelete="CASCADE"))
    product_id: Mapped[str] = mapped_column(GUID(), ForeignKey("products.id", ondelete="CASCADE"))
    batch_code: Mapped[str] = mapped_column(String(64), nullable=False)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False, default=Decimal("0"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), default=lambda: datetime.now(UTC)
    )

    tenant: Mapped["Tenant"] = relationship()
    product: Mapped["Product"] = relationship()
