-- Pending staff invites. Token is stored hashed; the raw token is shown once to the inviter.

create table if not exists invites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  branch_id uuid references branches (id) on delete set null,
  invited_by_user_id uuid not null references users (id) on delete cascade,
  email text not null,
  role text not null check (
    role in (
      'manager',
      'cashier',
      'stock_keeper',
      'accountant',
      'production_staff'
    )
  ),
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists invites_tenant_id_idx on invites (tenant_id);
create index if not exists invites_email_idx on invites (email);

alter table invites enable row level security;
