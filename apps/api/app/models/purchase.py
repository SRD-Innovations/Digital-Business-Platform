from datetime import UTC, datetime
from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.types import GUID

if TYPE_CHECKING:
    from app.models.branch import Branch
    from app.models.product import Product
    from app.models.supplier import Supplier
    from app.models.tenant import Tenant
    from app.models.user import User


class PurchaseReceipt(Base):
    __tablename__ = "purchase_receipts"

    id: Mapped[str] = mapped_column(GUID(), primary_key=True, default=lambda: str(uuid4()))
    tenant_id: Mapped[str] = mapped_column(GUID(), ForeignKey("tenants.id", ondelete="CASCADE"))
    supplier_id: Mapped[str] = mapped_column(GUID(), ForeignKey("suppliers.id", ondelete="RESTRICT"))
    branch_id: Mapped[str | None] = mapped_column(
        GUID(), ForeignKey("branches.id", ondelete="SET NULL"), nullable=True
    )
    received_by_user_id: Mapped[str] = mapped_column(GUID(), ForeignKey("users.id", ondelete="RESTRICT"))
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="received")
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), default=lambda: datetime.now(UTC)
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), default=lambda: datetime.now(UTC)
    )

    tenant: Mapped["Tenant"] = relationship()
    supplier: Mapped["Supplier"] = relationship()
    branch: Mapped["Branch | None"] = relationship()
    received_by: Mapped["User"] = relationship()
    lines: Mapped[list["PurchaseReceiptLine"]] = relationship(
        back_populates="receipt", cascade="all, delete-orphan"
    )


class PurchaseReceiptLine(Base):
    __tablename__ = "purchase_receipt_lines"

    id: Mapped[str] = mapped_column(GUID(), primary_key=True, default=lambda: str(uuid4()))
    receipt_id: Mapped[str] = mapped_column(GUID(), ForeignKey("purchase_receipts.id", ondelete="CASCADE"))
    product_id: Mapped[str] = mapped_column(GUID(), ForeignKey("products.id", ondelete="RESTRICT"))
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"))

    receipt: Mapped["PurchaseReceipt"] = relationship(back_populates="lines")
    product: Mapped["Product"] = relationship()
