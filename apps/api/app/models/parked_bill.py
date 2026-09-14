from datetime import UTC, datetime
from typing import Any, TYPE_CHECKING
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.models.base import Base
from app.models.types import GUID

if TYPE_CHECKING:
    from app.models.branch import Branch
    from app.models.tenant import Tenant
    from app.models.user import User


class ParkedBill(Base):
    __tablename__ = "parked_bills"

    id: Mapped[str] = mapped_column(GUID(), primary_key=True, default=lambda: str(uuid4()))
    tenant_id: Mapped[str] = mapped_column(GUID(), ForeignKey("tenants.id", ondelete="CASCADE"))
    branch_id: Mapped[str | None] = mapped_column(
        GUID(), ForeignKey("branches.id", ondelete="SET NULL"), nullable=True
    )
    cashier_user_id: Mapped[str] = mapped_column(GUID(), ForeignKey("users.id", ondelete="CASCADE"))
    label: Mapped[str] = mapped_column(String(120), nullable=False, default="Held")
    cart_json: Mapped[dict[str, Any]] = mapped_column(JSON().with_variant(JSONB(), "postgresql"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), default=lambda: datetime.now(UTC)
    )

    tenant: Mapped["Tenant"] = relationship()
    branch: Mapped["Branch | None"] = relationship()
