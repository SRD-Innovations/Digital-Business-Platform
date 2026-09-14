-- Staff can join without email. Phone is the Sri Lanka-first identifier.
-- Social logins (Google, Facebook, TikTok) attach via oauth_accounts.

alter table users alter column email drop not null;
alter table users alter column password_hash drop not null;

alter table users add column if not exists phone text;
create unique index if not exists users_phone_key on users (phone) where phone is not null;
create unique index if not exists users_email_key on users (email) where email is not null;

alter table invites alter column email drop not null;
alter table invites add column if not exists phone text;

create table if not exists oauth_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  provider text not null check (provider in ('google', 'facebook', 'tiktok')),
  provider_user_id text not null,
  created_at timestamptz not null default now(),
  unique (provider, provider_user_id)
);

create index if not exists oauth_accounts_user_id_idx on oauth_accounts (user_id);

alter table oauth_accounts enable row level security;
