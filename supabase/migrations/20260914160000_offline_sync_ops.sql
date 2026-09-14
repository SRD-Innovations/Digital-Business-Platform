-- Offline sync: idempotent client ops on sales + conflict log stub.

alter table sales add column if not exists client_op_id text;
alter table sales add column if not exists device_id text;

create unique index if not exists sales_tenant_client_op_key
  on sales (tenant_id, client_op_id)
  where client_op_id is not null;

create index if not exists sales_device_id_idx on sales (device_id)
  where device_id is not null;

create table if not exists sync_conflicts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  device_id text,
  op_type text not null,
  client_op_id text,
  payload jsonb not null,
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists sync_conflicts_tenant_id_idx on sync_conflicts (tenant_id);

alter table sync_conflicts enable row level security;
