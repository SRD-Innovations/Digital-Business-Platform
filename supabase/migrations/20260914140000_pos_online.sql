-- Online-first POS: catalog, sales, line items, and payments.
-- Stock on the product row is enough until ERP inventory lands.

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  name text not null,
  sku text,
  barcode text,
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  stock_on_hand numeric(12, 3) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists products_tenant_id_idx on products (tenant_id);
create unique index if not exists products_tenant_sku_key
  on products (tenant_id, sku) where sku is not null;
create unique index if not exists products_tenant_barcode_key
  on products (tenant_id, barcode) where barcode is not null;

create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  branch_id uuid references branches (id) on delete set null,
  cashier_user_id uuid not null references users (id) on delete restrict,
  receipt_number text not null,
  status text not null default 'completed'
    check (status in ('completed', 'voided')),
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  discount_total numeric(12, 2) not null default 0 check (discount_total >= 0),
  total numeric(12, 2) not null check (total >= 0),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists sales_tenant_id_idx on sales (tenant_id);
create index if not exists sales_tenant_created_at_idx on sales (tenant_id, created_at desc);
create unique index if not exists sales_tenant_receipt_key on sales (tenant_id, receipt_number);

create table if not exists sale_lines (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales (id) on delete cascade,
  product_id uuid references products (id) on delete set null,
  product_name text not null,
  quantity numeric(12, 3) not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  line_total numeric(12, 2) not null check (line_total >= 0)
);

create index if not exists sale_lines_sale_id_idx on sale_lines (sale_id);

create table if not exists sale_payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales (id) on delete cascade,
  method text not null check (method in ('cash', 'card', 'credit')),
  amount numeric(12, 2) not null check (amount > 0)
);

create index if not exists sale_payments_sale_id_idx on sale_payments (sale_id);

alter table products enable row level security;
alter table sales enable row level security;
alter table sale_lines enable row level security;
alter table sale_payments enable row level security;
