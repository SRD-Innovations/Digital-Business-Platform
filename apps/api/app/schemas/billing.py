from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class PlanOut(BaseModel):
    id: str
    code: str
    name: str
    description: str | None = None
    max_branches: int
    max_users: int
    includes_trade: bool
    includes_manufacturing: bool
    price_monthly_lkr: Decimal
    price_yearly_lkr: Decimal

    model_config = {"from_attributes": True}


class SubscriptionOut(BaseModel):
    id: str
    status: str
    billing_interval: str
    trial_ends_at: datetime | None = None
    current_period_end: datetime | None = None
    plan: PlanOut

    model_config = {"from_attributes": True}


class SubscribeRequest(BaseModel):
    plan_code: str = Field(min_length=2, max_length=32)
    billing_interval: str = Field(default="monthly")


class PayHereCheckoutOut(BaseModel):
    mode: str
    message: str
    order_id: str
    amount_lkr: Decimal
    plan_code: str
    checkout_url: str | None = None


class AdminTenantOut(BaseModel):
    id: str
    name: str
    slug: str
    created_at: datetime
    subscription_status: str | None = None
    plan_code: str | None = None

    model_config = {"from_attributes": True}
