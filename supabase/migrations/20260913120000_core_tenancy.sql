-- Core multi-tenancy: shared database, tenant_id on every tenant-owned row.

create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists branches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists branches_tenant_id_idx on branches (tenant_id);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  branch_id uuid references branches (id) on delete set null,
  email text not null unique,
  password_hash text not null,
  full_name text not null,
  role text not null check (
    role in (
      'owner',
      'manager',
      'cashier',
      'stock_keeper',
      'accountant',
      'production_staff'
    )
  ),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists users_tenant_id_idx on users (tenant_id);
