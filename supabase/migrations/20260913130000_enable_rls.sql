-- Row Level Security: deny PostgREST / anon / authenticated by default.
-- FastAPI connects as a table-owner / superuser role and still bypasses RLS.
-- That is intentional until we introduce a non-bypass app role.

alter table tenants enable row level security;
alter table branches enable row level security;
alter table users enable row level security;
