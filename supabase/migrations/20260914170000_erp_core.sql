-- ERP core first cut: suppliers, purchase receipts, inventory movement log.

create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  name text not null,
  phone text,
  email text,
  note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists suppliers_tenant_id_idx on suppliers (tenant_id);

create table if not exists purchase_receipts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  supplier_id uuid not null references suppliers (id) on delete restrict,
  branch_id uuid references branches (id) on delete set null,
  received_by_user_id uuid not null references users (id) on delete restrict,
  status text not null default 'received' check (status in ('received')),
  note text,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists purchase_receipts_tenant_id_idx on purchase_receipts (tenant_id);
create index if not exists purchase_receipts_supplier_id_idx on purchase_receipts (supplier_id);

create table if not exists purchase_receipt_lines (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references purchase_receipts (id) on delete cascade,
  product_id uuid not null references products (id) on delete restrict,
  quantity numeric(12, 3) not null check (quantity > 0),
  unit_cost numeric(12, 2) not null default 0 check (unit_cost >= 0)
);

create index if not exists purchase_receipt_lines_receipt_id_idx on purchase_receipt_lines (receipt_id);

create table if not exists inventory_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  product_id uuid not null references products (id) on delete restrict,
  quantity numeric(12, 3) not null check (quantity <> 0),
  reason text not null check (
    reason in ('sale', 'void', 'return', 'purchase_receive', 'adjustment', 'opening')
  ),
  ref_type text,
  ref_id uuid,
  note text,
  created_by_user_id uuid references users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists inventory_movements_tenant_id_idx on inventory_movements (tenant_id);
create index if not exists inventory_movements_product_id_idx on inventory_movements (product_id);
create index if not exists inventory_movements_created_at_idx on inventory_movements (tenant_id, created_at desc);

alter table suppliers enable row level security;
alter table purchase_receipts enable row level security;
alter table purchase_receipt_lines enable row level security;
alter table inventory_movements enable row level security;
