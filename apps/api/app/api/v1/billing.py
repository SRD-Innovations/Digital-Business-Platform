from datetime import UTC, datetime, timedelta
from secrets import token_hex

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import MANAGE_ROLES, get_current_user, require_roles
from app.core.config import settings
from app.core.db import get_db
from app.models.billing import Plan, Subscription
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.billing import (
    AdminTenantOut,
    PayHereCheckoutOut,
    PlanOut,
    SubscribeRequest,
    SubscriptionOut,
)
from app.services.billing import get_plan_by_code, load_subscription

router = APIRouter(tags=["billing"])


def require_platform_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_platform_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Platform admin only")
    return user


@router.get("/billing/plans", response_model=list[PlanOut])
def list_plans(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Plan]:
    _ = user
    return list(db.scalars(select(Plan).where(Plan.is_active.is_(True)).order_by(Plan.sort_order)))


@router.get("/billing/subscription", response_model=SubscriptionOut | None)
def get_subscription(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Subscription | None:
    return load_subscription(db, user.tenant_id)


@router.post("/billing/subscribe", response_model=SubscriptionOut)
def subscribe(
    body: SubscribeRequest,
    user: User = Depends(require_roles(*MANAGE_ROLES)),
    db: Session = Depends(get_db),
) -> Subscription:
    if body.billing_interval not in {"monthly", "yearly"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="billing_interval must be monthly or yearly")
    plan = get_plan_by_code(db, body.plan_code)
    if plan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")

    sub = load_subscription(db, user.tenant_id)
    period_days = 365 if body.billing_interval == "yearly" else 30
    # MVP: activate without live PayHere charge; returns checkout stub separately.
    if sub is None:
        sub = Subscription(
            tenant_id=user.tenant_id,
            plan_id=plan.id,
            status="active",
            billing_interval=body.billing_interval,
            trial_ends_at=None,
            current_period_end=datetime.now(UTC) + timedelta(days=period_days),
        )
        db.add(sub)
    else:
        sub.plan_id = plan.id
        sub.status = "active"
        sub.billing_interval = body.billing_interval
        sub.trial_ends_at = None
        sub.current_period_end = datetime.now(UTC) + timedelta(days=period_days)
        sub.updated_at = datetime.now(UTC)
    db.commit()
    loaded = load_subscription(db, user.tenant_id)
    assert loaded is not None
    return loaded


@router.post("/billing/payhere/checkout", response_model=PayHereCheckoutOut)
def payhere_checkout(
    body: SubscribeRequest,
    user: User = Depends(require_roles(*MANAGE_ROLES)),
    db: Session = Depends(get_db),
) -> PayHereCheckoutOut:
    plan = get_plan_by_code(db, body.plan_code)
    if plan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")
    amount = plan.price_yearly_lkr if body.billing_interval == "yearly" else plan.price_monthly_lkr
    order_id = f"dbp-{user.tenant_id[:8]}-{token_hex(4)}"
    configured = bool(settings.payhere_merchant_id and settings.payhere_merchant_secret)
    return PayHereCheckoutOut(
        mode="live" if configured else "stub",
        message=(
            "PayHere credentials configured — wire hosted checkout next."
            if configured
            else "PayHere not configured yet. Use POST /billing/subscribe to activate the plan in MVP."
        ),
        order_id=order_id,
        amount_lkr=amount,
        plan_code=plan.code,
        checkout_url=None,
    )


@router.get("/admin/tenants", response_model=list[AdminTenantOut])
def admin_list_tenants(
    user: User = Depends(require_platform_admin),
    db: Session = Depends(get_db),
) -> list[AdminTenantOut]:
    _ = user
    tenants = list(db.scalars(select(Tenant).order_by(Tenant.created_at.desc()).limit(100)))
    out: list[AdminTenantOut] = []
    for tenant in tenants:
        sub = load_subscription(db, tenant.id)
        out.append(
            AdminTenantOut(
                id=tenant.id,
                name=tenant.name,
                slug=tenant.slug,
                created_at=tenant.created_at,
                subscription_status=sub.status if sub else None,
                plan_code=sub.plan.code if sub and sub.plan else None,
            )
        )
    return out
