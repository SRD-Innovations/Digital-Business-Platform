-- Subscription plans, tenant subscriptions, platform admin flag.

create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  max_branches int not null check (max_branches >= 1),
  max_users int not null check (max_users >= 1),
  includes_trade boolean not null default false,
  includes_manufacturing boolean not null default false,
  price_monthly_lkr numeric(12, 2) not null default 0 check (price_monthly_lkr >= 0),
  price_yearly_lkr numeric(12, 2) not null default 0 check (price_yearly_lkr >= 0),
  is_active boolean not null default true,
  sort_order int not null default 0
);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references tenants (id) on delete cascade,
  plan_id uuid not null references plans (id) on delete restrict,
  status text not null check (status in ('trialing', 'active', 'past_due', 'canceled')),
  billing_interval text not null default 'monthly'
    check (billing_interval in ('monthly', 'yearly')),
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  payhere_order_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_plan_id_idx on subscriptions (plan_id);
create index if not exists subscriptions_status_idx on subscriptions (status);

alter table users add column if not exists is_platform_admin boolean not null default false;

insert into plans (
  code, name, description, max_branches, max_users,
  includes_trade, includes_manufacturing,
  price_monthly_lkr, price_yearly_lkr, sort_order
)
values
  (
    'solo',
    'Solo',
    'Self-employed / core only',
    1, 2, false, false, 0, 0, 10
  ),
  (
    'starter',
    'Starter',
    'Single shop or mill, one module family',
    1, 3, true, false, 4500, 45000, 20
  ),
  (
    'standard',
    'Standard',
    'Small chain, both module families',
    3, 10, true, true, 9900, 99000, 30
  ),
  (
    'premium',
    'Premium',
    'Larger operator, unlimited branches/users in MVP soft limits',
    100, 500, true, true, 19900, 199000, 40
  )
on conflict (code) do nothing;

alter table plans enable row level security;
alter table subscriptions enable row level security;
