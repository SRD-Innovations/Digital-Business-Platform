-- Shifts, parked carts, and return/void support for online POS.

create table if not exists shifts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  branch_id uuid references branches (id) on delete set null,
  opened_by_user_id uuid not null references users (id) on delete restrict,
  closed_by_user_id uuid references users (id) on delete set null,
  opening_cash numeric(12, 2) not null default 0 check (opening_cash >= 0),
  closing_cash numeric(12, 2) check (closing_cash is null or closing_cash >= 0),
  expected_cash numeric(12, 2),
  cash_sales_total numeric(12, 2) not null default 0,
  card_sales_total numeric(12, 2) not null default 0,
  credit_sales_total numeric(12, 2) not null default 0,
  status text not null default 'open' check (status in ('open', 'closed')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  note text
);

create index if not exists shifts_tenant_id_idx on shifts (tenant_id);
create index if not exists shifts_tenant_status_idx on shifts (tenant_id, status);

create table if not exists parked_bills (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  branch_id uuid references branches (id) on delete set null,
  cashier_user_id uuid not null references users (id) on delete cascade,
  label text not null default 'Held',
  cart_json jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists parked_bills_tenant_id_idx on parked_bills (tenant_id);

alter table sales add column if not exists shift_id uuid references shifts (id) on delete set null;
alter table sales add column if not exists refund_of_sale_id uuid references sales (id) on delete set null;

alter table sales drop constraint if exists sales_status_check;
alter table sales add constraint sales_status_check
  check (status in ('completed', 'voided', 'returned'));

create index if not exists sales_shift_id_idx on sales (shift_id);
create index if not exists sales_refund_of_sale_id_idx on sales (refund_of_sale_id);

alter table shifts enable row level security;
alter table parked_bills enable row level security;
