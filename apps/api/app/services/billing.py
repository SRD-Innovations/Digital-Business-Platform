from datetime import UTC, datetime, timedelta
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models.billing import Plan, Subscription
from app.models.branch import Branch
from app.models.user import User

TRIAL_DAYS = 21
DEFAULT_TRIAL_PLAN_CODE = "starter"


def ensure_default_plans(db: Session) -> None:
    existing = {plan.code for plan in db.scalars(select(Plan)).all()}
    defaults = [
        Plan(
            code="solo",
            name="Solo",
            description="Self-employed / core only",
            max_branches=1,
            max_users=2,
            includes_trade=False,
            includes_manufacturing=False,
            price_monthly_lkr=Decimal("0"),
            price_yearly_lkr=Decimal("0"),
            sort_order=10,
        ),
        Plan(
            code="starter",
            name="Starter",
            description="Single shop or mill, one module family",
            max_branches=1,
            max_users=3,
            includes_trade=True,
            includes_manufacturing=False,
            price_monthly_lkr=Decimal("4500"),
            price_yearly_lkr=Decimal("45000"),
            sort_order=20,
        ),
        Plan(
            code="standard",
            name="Standard",
            description="Small chain, both module families",
            max_branches=3,
            max_users=10,
            includes_trade=True,
            includes_manufacturing=True,
            price_monthly_lkr=Decimal("9900"),
            price_yearly_lkr=Decimal("99000"),
            sort_order=30,
        ),
        Plan(
            code="premium",
            name="Premium",
            description="Larger operator",
            max_branches=100,
            max_users=500,
            includes_trade=True,
            includes_manufacturing=True,
            price_monthly_lkr=Decimal("19900"),
            price_yearly_lkr=Decimal("199000"),
            sort_order=40,
        ),
    ]
    for plan in defaults:
        if plan.code not in existing:
            db.add(plan)
    db.flush()


def get_plan_by_code(db: Session, code: str) -> Plan | None:
    return db.scalar(select(Plan).where(Plan.code == code, Plan.is_active.is_(True)))


def start_trial_subscription(db: Session, tenant_id: str, plan_code: str = DEFAULT_TRIAL_PLAN_CODE) -> Subscription:
    ensure_default_plans(db)
    plan = get_plan_by_code(db, plan_code) or get_plan_by_code(db, "solo")
    if plan is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Billing plans missing")
    sub = Subscription(
        tenant_id=tenant_id,
        plan_id=plan.id,
        status="trialing",
        billing_interval="monthly",
        trial_ends_at=datetime.now(UTC) + timedelta(days=TRIAL_DAYS),
        current_period_end=datetime.now(UTC) + timedelta(days=TRIAL_DAYS),
    )
    db.add(sub)
    return sub


def load_subscription(db: Session, tenant_id: str) -> Subscription | None:
    return db.scalar(
        select(Subscription)
        .options(joinedload(Subscription.plan))
        .where(Subscription.tenant_id == tenant_id)
    )


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def ensure_subscription_allows_access(db: Session, tenant_id: str) -> Subscription:
    sub = load_subscription(db, tenant_id)
    if sub is None:
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail="No subscription found")
    if sub.status == "canceled":
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail="Subscription canceled")
    trial_end = _as_utc(sub.trial_ends_at)
    if sub.status == "trialing" and trial_end and trial_end < datetime.now(UTC):
        sub.status = "past_due"
        db.add(sub)
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail="Trial ended — choose a plan")
    if sub.status == "past_due":
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail="Subscription past due")
    return sub


def assert_can_add_branch(db: Session, tenant_id: str) -> None:
    sub = ensure_subscription_allows_access(db, tenant_id)
    count = db.scalar(select(func.count()).select_from(Branch).where(Branch.tenant_id == tenant_id)) or 0
    if count >= sub.plan.max_branches:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Plan limit: max {sub.plan.max_branches} branches",
        )


def assert_can_add_user(db: Session, tenant_id: str) -> None:
    sub = ensure_subscription_allows_access(db, tenant_id)
    count = db.scalar(select(func.count()).select_from(User).where(User.tenant_id == tenant_id)) or 0
    if count >= sub.plan.max_users:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Plan limit: max {sub.plan.max_users} users",
        )
