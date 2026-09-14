-- Business profile fields for IRD-style receipts (TIN / VAT / address).

alter table tenants
  add column if not exists legal_name text,
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists city text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists tin text,
  add column if not exists vat_number text;
