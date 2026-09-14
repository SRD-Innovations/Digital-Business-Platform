-- Trade family: wholesale quantity tiers, supplier catalog costs, batch/expiry lots.

alter table products add column if not exists track_batches boolean not null default false;

create table if not exists product_price_tiers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  product_id uuid not null references products (id) on delete cascade,
  min_qty numeric(12, 3) not null check (min_qty > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  unique (product_id, min_qty)
);

create index if not exists product_price_tiers_product_id_idx on product_price_tiers (product_id);

create table if not exists supplier_prices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  supplier_id uuid not null references suppliers (id) on delete cascade,
  product_id uuid not null references products (id) on delete cascade,
  unit_cost numeric(12, 2) not null check (unit_cost >= 0),
  unique (supplier_id, product_id)
);

create index if not exists supplier_prices_supplier_id_idx on supplier_prices (supplier_id);

create table if not exists product_batches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  product_id uuid not null references products (id) on delete cascade,
  batch_code text not null,
  expiry_date date,
  quantity numeric(12, 3) not null default 0 check (quantity >= 0),
  created_at timestamptz not null default now(),
  unique (product_id, batch_code)
);

create index if not exists product_batches_product_id_idx on product_batches (product_id);
create index if not exists product_batches_expiry_idx on product_batches (product_id, expiry_date);

alter table purchase_receipt_lines add column if not exists batch_code text;
alter table purchase_receipt_lines add column if not exists expiry_date date;

alter table sale_lines add column if not exists batch_id uuid references product_batches (id) on delete set null;

alter table product_price_tiers enable row level security;
alter table supplier_prices enable row level security;
alter table product_batches enable row level security;
