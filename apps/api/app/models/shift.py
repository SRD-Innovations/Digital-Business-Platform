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
    from app.models.tenant import Tenant
    from app.models.user import User


class Shift(Base):
    __tablename__ = "shifts"

    id: Mapped[str] = mapped_column(GUID(), primary_key=True, default=lambda: str(uuid4()))
    tenant_id: Mapped[str] = mapped_column(GUID(), ForeignKey("tenants.id", ondelete="CASCADE"))
    branch_id: Mapped[str | None] = mapped_column(
        GUID(), ForeignKey("branches.id", ondelete="SET NULL"), nullable=True
    )
    opened_by_user_id: Mapped[str] = mapped_column(GUID(), ForeignKey("users.id", ondelete="RESTRICT"))
    closed_by_user_id: Mapped[str | None] = mapped_column(
        GUID(), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    opening_cash: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"))
    closing_cash: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    expected_cash: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    cash_sales_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"))
    card_sales_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"))
    credit_sales_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"))
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="open")
    opened_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), default=lambda: datetime.now(UTC)
    )
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    tenant: Mapped["Tenant"] = relationship()
    branch: Mapped["Branch | None"] = relationship()
