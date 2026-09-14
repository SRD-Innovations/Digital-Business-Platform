-- Manufacturing: BOM, production runs (conversion), yield/wastage, simple batch cost.

create table if not exists boms (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  finished_product_id uuid not null references products (id) on delete restrict,
  name text not null,
  expected_yield_pct numeric(6, 2) not null default 100
    check (expected_yield_pct > 0 and expected_yield_pct <= 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists boms_tenant_id_idx on boms (tenant_id);
create index if not exists boms_finished_product_id_idx on boms (finished_product_id);

create table if not exists bom_lines (
  id uuid primary key default gen_random_uuid(),
  bom_id uuid not null references boms (id) on delete cascade,
  component_product_id uuid not null references products (id) on delete restrict,
  quantity_per_output numeric(12, 3) not null check (quantity_per_output > 0),
  unique (bom_id, component_product_id)
);

create index if not exists bom_lines_bom_id_idx on bom_lines (bom_id);

create table if not exists production_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  bom_id uuid not null references boms (id) on delete restrict,
  finished_product_id uuid not null references products (id) on delete restrict,
  planned_output_qty numeric(12, 3) not null check (planned_output_qty > 0),
  actual_output_qty numeric(12, 3) not null check (actual_output_qty >= 0),
  yield_pct numeric(8, 2) not null,
  wastage_pct numeric(8, 2) not null,
  unit_cost numeric(12, 4) not null default 0,
  total_component_cost numeric(12, 2) not null default 0,
  status text not null default 'completed' check (status in ('completed')),
  note text,
  created_by_user_id uuid not null references users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists production_runs_tenant_id_idx on production_runs (tenant_id);
create index if not exists production_runs_created_at_idx on production_runs (tenant_id, created_at desc);

create table if not exists production_run_lines (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references production_runs (id) on delete cascade,
  component_product_id uuid not null references products (id) on delete restrict,
  quantity numeric(12, 3) not null check (quantity > 0),
  unit_cost numeric(12, 2) not null default 0,
  line_cost numeric(12, 2) not null default 0
);

create index if not exists production_run_lines_run_id_idx on production_run_lines (run_id);

alter table inventory_movements drop constraint if exists inventory_movements_reason_check;
alter table inventory_movements add constraint inventory_movements_reason_check
  check (
    reason in (
      'sale',
      'void',
      'return',
      'purchase_receive',
      'adjustment',
      'opening',
      'manufacture_consume',
      'manufacture_output'
    )
  );

alter table boms enable row level security;
alter table bom_lines enable row level security;
alter table production_runs enable row level security;
alter table production_run_lines enable row level security;
