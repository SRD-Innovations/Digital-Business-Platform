# Digital Business Platform — API integration guide

Partner and marketing reference for integrating with the **Digital Business Platform** REST API (`/v1`).

Use this document when pitching integrations, building partner apps, or wiring POS / ERP / billing clients. Interactive OpenAPI remains the live contract: **`/v1/docs`**, **`/v1/redoc`**, **`/v1/openapi.json`**.

| Environment | Base URL |
| --- | --- |
| Production API | `https://digital-business-platform.onrender.com` |
| Local API | `http://localhost:8000` |
| Interactive docs | `{base}/v1/docs` |

All business routes are under **`/v1`**. Content type: **`application/json`**.

---

## 1. What you can integrate

The API is a **multi-tenant SaaS operating system** for Sri Lankan trade and manufacturing businesses:

| Domain | What partners get |
| --- | --- |
| Auth & tenancy | Register business, JWT login, OAuth (Google / Facebook / TikTok when configured), roles, branches, invites |
| Business profile | Trading name, legal name, address, TIN, VAT — for receipts and tax-facing docs |
| POS | Products, shifts, checkout, split pay, park/hold, void, returns, offline idempotency |
| ERP | Suppliers, purchase receive, stock movements, adjustments, sales reports |
| Trade | Wholesale price tiers, batch/expiry tracking, supplier costs |
| Manufacturing | BOM, production runs, yield/wastage, unit cost |
| Billing | Plans, trial/subscription, PayHere checkout stub, platform admin tenant list |

**Money is LKR.** UI language for MVP is English.

---

## 2. Authentication

### Header

```http
Authorization: Bearer <access_token>
```

- Scheme: **`bearer`**
- JWT (HS256) claims: `sub` (user id), `tenant_id`, `role`, `exp`
- Default token lifetime: **480 minutes** (8 hours)
- Auth success payloads also include `token_type: "bearer"` and a nested `user` object

### Register a business

`POST /v1/auth/register` → `201`

Creates tenant + default **Main** branch + owner user, starts a **21-day Starter trial**, returns JWT.

**Body**

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `business_name` | string | yes | 2–200 |
| `full_name` | string | yes | 2–200 |
| `email` | string (email) | yes | Unique |
| `password` | string | yes | 8–128 |

**Response (`TokenResponse`)**

```json
{
  "access_token": "<jwt>",
  "token_type": "bearer",
  "user": { "...UserOut..." }
}
```

### Login

`POST /v1/auth/login`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `password` | string | yes | 8–128 |
| `identifier` | string | one of | Email or Sri Lankan phone (normalized to `+94…`) |
| `email` | string | one of | Alternate to `identifier` |

### Current user

`GET /v1/auth/me` → `UserOut` (any authenticated role)

### OAuth (browser redirects)

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/v1/auth/oauth/providers` | `{ "google": bool, "facebook": bool, "tiktok": bool }` |
| `GET` | `/v1/auth/oauth/{provider}/start` | Begin OAuth (`intent`: `login` \| `register` \| `join`; optional `invite_token`, `business_name`) |
| `GET` | `/v1/auth/oauth/{provider}/callback` | IdP callback → redirect to web with `access_token` or `error` |

Providers: `google` | `facebook` | `tiktok`.

---

## 3. Conventions

| Topic | Rule |
| --- | --- |
| IDs | UUID strings |
| Money / prices | JSON **strings** (e.g. `"4500.00"`), typically 2 decimal places |
| Quantities | Decimal strings, often 3 decimal places |
| Dates | `YYYY-MM-DD` |
| Datetimes | ISO-8601 (timezone-aware when stored) |
| Tenancy | Almost all authenticated routes are scoped to the JWT `tenant_id` |
| Blank strings | Many optional strings coerce `""` → `null` |
| Errors | `{ "detail": "message" }` or FastAPI 422 validation array |

### Roles

| Group | Roles |
| --- | --- |
| Manage | `owner`, `manager` |
| POS | `owner`, `manager`, `cashier` |
| Catalog / inventory write | `owner`, `manager`, `stock_keeper` |
| Reports | `owner`, `manager`, `accountant` |
| Manufacturing write | `owner`, `manager`, `production_staff`, `stock_keeper` |
| Platform admin | `is_platform_admin` on user (email allowlist) |

Invite matrix: **owner** can invite all staff roles; **manager** can invite cashier, stock_keeper, accountant, production_staff (not another manager).

### Plan limits (enforced)

| Limit | When | Status |
| --- | --- | --- |
| `max_branches` | `POST /v1/branches` | `403` |
| `max_users` | `POST /v1/invites` | `403` |
| Subscription / trial | Same asserts | `402` if missing, canceled, trial ended, or past due |

Plan flags `includes_trade` / `includes_manufacturing` are returned on plan objects; route-level module gating is not enforced yet.

### Offline / idempotent checkout

On `POST /v1/pos/checkout`:

| Field | Notes |
| --- | --- |
| `client_op_id` | Optional 8–64 chars. Same tenant + id → return existing sale (no double charge) |
| `device_id` | Optional 4–64 chars. Stored for device attribution |

---

## 4. Shared schemas

### `TenantOut`

| Field | Type |
| --- | --- |
| `id` | string |
| `name` | string |
| `slug` | string |
| `legal_name` | string \| null |
| `address_line1` | string \| null |
| `address_line2` | string \| null |
| `city` | string \| null |
| `phone` | string \| null |
| `email` | string \| null |
| `tin` | string \| null |
| `vat_number` | string \| null |

### `BranchOut`

`id`, `name`

### `UserOut`

`id`, `email`, `phone`, `full_name`, `role`, `is_platform_admin`, `tenant` (`TenantOut`), `branch` (`BranchOut` \| null)

### `ProductOut`

`id`, `name`, `sku`, `barcode`, `unit_price`, `stock_on_hand`, `track_batches`, `is_active`

### `SaleOut`

| Field | Notes |
| --- | --- |
| `id`, `receipt_number`, `status` | Status e.g. completed / voided / returned |
| `branch_id`, `cashier_user_id`, `shift_id` | |
| `refund_of_sale_id` | Set on return receipts |
| `client_op_id`, `device_id` | Offline sync |
| `subtotal`, `discount_total`, `total` | Money strings |
| `note`, `created_at` | |
| `lines[]` | `id`, `product_id`, `product_name`, `quantity`, `unit_price`, `line_total`, `batch_id` |
| `payments[]` | `id`, `method` (`cash`\|`card`\|`credit`), `amount` |

---

## 5. Tenant (business profile)

| Method | Path | Auth | Roles |
| --- | --- | --- | --- |
| `GET` | `/v1/tenant` | yes | any |
| `PATCH` | `/v1/tenant` | yes | owner, manager |

**`PATCH` body (`TenantUpdate`)** — all optional:

`name` (2–200), `legal_name`, `address_line1`, `address_line2`, `city`, `phone`, `email`, `tin`, `vat_number`

Used for IRD-facing receipt headers (TIN / VAT / address).

---

## 6. Branches

| Method | Path | Auth | Roles | Body |
| --- | --- | --- | --- | --- |
| `GET` | `/v1/branches` | yes | any | — |
| `POST` | `/v1/branches` | yes | owner, manager | `{ "name": "Branch 2" }` (2–200) |

Plan `max_branches` enforced on create.

---

## 7. Team & invites

| Method | Path | Auth | Roles |
| --- | --- | --- | --- |
| `GET` | `/v1/team` | yes | any |
| `GET` | `/v1/invites` | yes | owner, manager |
| `POST` | `/v1/invites` | yes | owner, manager |
| `POST` | `/v1/invites/accept` | **no** | — |

### Create invite — `POST /v1/invites` → `201`

**Body**

| Field | Required | Notes |
| --- | --- | --- |
| `role` | yes | Invitable staff role |
| `email` | one of | |
| `phone` | one of | LK mobile preferred |
| `branch_id` | no | |

**Response**

```json
{
  "invite": { "id": "...", "email": null, "phone": "+94...", "role": "cashier", "branch": null, "expires_at": "...", "accepted_at": null },
  "token": "<raw once>",
  "join_path": "/join?token=..."
}
```

Invites expire in **7 days**. Plan `max_users` enforced.

### Accept invite — `POST /v1/invites/accept`

| Field | Required |
| --- | --- |
| `token` | yes (min 8) |
| `full_name` | yes |
| `password` | yes |

→ `TokenResponse`

---

## 8. POS

### Products

| Method | Path | Roles |
| --- | --- | --- |
| `GET` | `/v1/products?active_only=true` | any authenticated |
| `POST` | `/v1/products` | owner, manager, stock_keeper |
| `PATCH` | `/v1/products/{product_id}` | owner, manager, stock_keeper |

**Create body**

| Field | Required | Notes |
| --- | --- | --- |
| `name` | yes | 1–200 |
| `sku` | no | max 64 |
| `barcode` | no | max 64 |
| `unit_price` | yes | ≥ 0 |
| `stock_on_hand` | no | default `0` |
| `track_batches` | no | default `false` |

**Update body** — any of: `name`, `sku`, `barcode`, `unit_price`, `stock_on_hand`, `track_batches`, `is_active`

### Shifts

| Method | Path | Body |
| --- | --- | --- |
| `GET` | `/v1/pos/shifts/current?branch_id=` | — |
| `POST` | `/v1/pos/shifts/open` | `{ "branch_id"?: "...", "opening_cash": "0.00" }` |
| `POST` | `/v1/pos/shifts/{shift_id}/close` | `{ "closing_cash": "1000.00", "note"?: "..." }` |

Roles: owner, manager, cashier. Checkout requires an **open shift**.

**`ShiftOut` highlights:** `opening_cash`, `closing_cash`, `expected_cash`, `cash_sales_total`, `card_sales_total`, `credit_sales_total`, `status`, `opened_at`, `closed_at`, `variance`

### Parked bills

| Method | Path |
| --- | --- |
| `GET` | `/v1/pos/parked` |
| `POST` | `/v1/pos/park` |
| `DELETE` | `/v1/pos/parked/{parked_id}` → `204` |

**Park body**

```json
{
  "label": "Held",
  "branch_id": null,
  "discount_total": "0",
  "note": null,
  "lines": [{ "product_id": "<uuid>", "quantity": "1" }]
}
```

`cart_json` on response stores `discount_total`, `note`, and `lines`.

### Checkout (core sale)

`POST /v1/pos/checkout` → `201` `SaleOut`

**Body**

```json
{
  "branch_id": null,
  "discount_total": "0.00",
  "note": null,
  "lines": [
    { "product_id": "<uuid>", "quantity": "2" }
  ],
  "payments": [
    { "method": "cash", "amount": "900.00" },
    { "method": "card", "amount": "100.00" }
  ],
  "parked_bill_id": null,
  "client_op_id": "device-op-abc12345",
  "device_id": "pos-front-01"
}
```

| Rule | Detail |
| --- | --- |
| Lines | min 1; `quantity` > 0 |
| Payments | min 1; `method` ∈ `cash` \| `card` \| `credit`; amounts must **sum to sale total** |
| Batches | FEFO applied when `track_batches` is true |

### Sales history / void / return

| Method | Path | Roles | Body |
| --- | --- | --- | --- |
| `GET` | `/v1/sales` | POS | — (latest 50) |
| `GET` | `/v1/sales/{sale_id}` | POS | — |
| `POST` | `/v1/sales/{sale_id}/void` | owner, manager | none |
| `POST` | `/v1/sales/{sale_id}/return` | POS | see below |

**Return body**

```json
{
  "lines": [{ "sale_line_id": "<uuid>", "quantity": "1" }],
  "restock": true,
  "note": null
}
```

Omit `lines` for a full return. Creates a return receipt (`status: "returned"`, receipt prefix `X`).

---

## 9. ERP

### Suppliers

| Method | Path |
| --- | --- |
| `GET` | `/v1/suppliers?active_only=true` |
| `POST` | `/v1/suppliers` |
| `PATCH` | `/v1/suppliers/{supplier_id}` |

**Create:** `name` (req), `phone`, `email`, `note`  
**Update:** `name`, `phone`, `email`, `note`, `is_active`

### Purchase receive

`POST /v1/purchases/receive` → `201`

```json
{
  "supplier_id": "<uuid>",
  "branch_id": null,
  "note": null,
  "lines": [
    {
      "product_id": "<uuid>",
      "quantity": "10",
      "unit_cost": "50.00",
      "batch_code": "B1",
      "expiry_date": "2027-01-31"
    }
  ]
}
```

Batch-tracked products require `batch_code`. List: `GET /v1/purchases/receipts`.

### Inventory

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/v1/inventory/movements?product_id=&limit=50` | Reasons include sale, purchase, adjustment, manufacture, etc. |
| `POST` | `/v1/inventory/adjustments` | `{ "product_id", "quantity_delta", "note"? }` — delta ≠ 0 |

### Sales report

`GET /v1/reports/sales?from_date=2026-01-01&to_date=2026-01-31`

**Response:** `completed_sales`, `gross_total`, `by_day[]`, `top_products[]`, `by_payment[]`

---

## 10. Trade module

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/v1/products/{id}/price-tiers` | List qty breaks |
| `PUT` | `/v1/products/{id}/price-tiers` | Replace tiers: `{ "tiers": [{ "min_qty", "unit_price" }] }` |
| `PATCH` | `/v1/products/{id}/track-batches` | `{ "track_batches": true }` |
| `GET` | `/v1/products/{id}/batches` | Lot / expiry stock |
| `GET` | `/v1/suppliers/{id}/prices` | Supplier cost list |
| `PUT` | `/v1/suppliers/{id}/prices` | Upsert `{ "product_id", "unit_cost" }` |

---

## 11. Manufacturing module

| Method | Path |
| --- | --- |
| `GET` | `/v1/boms?active_only=true` |
| `POST` | `/v1/boms` |
| `GET` | `/v1/production/runs` |
| `POST` | `/v1/production/runs` |

**BOM create**

```json
{
  "name": "Rice mix",
  "finished_product_id": "<uuid>",
  "expected_yield_pct": "100",
  "lines": [
    { "component_product_id": "<uuid>", "quantity_per_output": "1.5" }
  ]
}
```

**Production run create**

```json
{
  "bom_id": "<uuid>",
  "planned_output_qty": "100",
  "actual_output_qty": "95",
  "note": null
}
```

Consumes components, adds finished stock, records `yield_pct`, `wastage_pct`, `unit_cost`, `total_component_cost`.

---

## 12. Billing

| Method | Path | Roles |
| --- | --- | --- |
| `GET` | `/v1/billing/plans` | any |
| `GET` | `/v1/billing/subscription` | any |
| `POST` | `/v1/billing/subscribe` | owner, manager |
| `POST` | `/v1/billing/payhere/checkout` | owner, manager |
| `GET` | `/v1/admin/tenants` | platform admin |

### Plans (`PlanOut`)

`code`, `name`, `description`, `max_branches`, `max_users`, `includes_trade`, `includes_manufacturing`, `price_monthly_lkr`, `price_yearly_lkr`

Seeded codes: **`solo`**, **`starter`**, **`standard`**, **`premium`**.

### Subscribe (MVP — no live charge)

```json
{ "plan_code": "standard", "billing_interval": "monthly" }
```

`billing_interval`: `monthly` | `yearly`.

### PayHere checkout (stub)

Same body as subscribe. Response includes `mode` (`stub` \| `live`), `order_id`, `amount_lkr`, `plan_code`, `checkout_url` (**null until live keys**), and a human `message`. Does not charge today; activation remains `POST /v1/billing/subscribe`.

### Platform admin

`GET /v1/admin/tenants` → list of `{ id, name, slug, created_at, subscription_status, plan_code }` (max 100).

---

## 13. Health

`GET /v1/health` (public)

```json
{
  "status": "ok",
  "service": "dbp-api",
  "env": "...",
  "database": "configured"
}
```

---

## 14. Quick-start integration flow

Typical partner or channel app:

1. **`POST /v1/auth/register`** or **`POST /v1/auth/login`** → store `access_token`
2. **`PATCH /v1/tenant`** → set TIN / VAT / address for receipts
3. **`POST /v1/products`** → seed catalog (optional barcodes for scanners)
4. **`POST /v1/pos/shifts/open`** → open cashier shift
5. **`POST /v1/pos/checkout`** with optional `client_op_id` for offline-safe retries
6. **`GET /v1/sales`** / print from `SaleOut` + tenant profile
7. ERP path: suppliers → receive → inventory movements → reports
8. Optional: Trade tiers/batches, Manufacturing BOM/runs, Billing subscribe

---

## 15. Endpoint map (52)

| Domain | Count | Prefix highlights |
| --- | --- | --- |
| Health | 1 | `/v1/health` |
| Auth | 3 | `/v1/auth/*` |
| OAuth | 3 | `/v1/auth/oauth/*` |
| Tenant | 2 | `/v1/tenant` |
| Branches | 2 | `/v1/branches` |
| Team | 4 | `/v1/team`, `/v1/invites` |
| POS | 14 | `/v1/products`, `/v1/pos/*`, `/v1/sales` |
| ERP | 8 | `/v1/suppliers`, `/v1/purchases`, `/v1/inventory`, `/v1/reports` |
| Trade | 6 | price-tiers, batches, supplier prices |
| Manufacturing | 4 | `/v1/boms`, `/v1/production/runs` |
| Billing | 5 | `/v1/billing/*`, `/v1/admin/tenants` |

---

## 16. Marketing talking points

- **One REST surface** for POS + ERP + Trade + Manufacturing — not a POS bolt-on.
- **Multi-tenant JWT** with branch-aware roles built for Sri Lankan shop floors.
- **Offline-ready checkout** via `client_op_id` / `device_id` (pairs with the web PWA sync queue).
- **LKR-first** money as precise decimal strings; English MVP with TIN/VAT on the business profile for receipt/tax docs.
- **Modular families** — Trade (barcode, batches, wholesale tiers) and Manufacturing (BOM, yield, costing) on the same core.
- **Subscription-aware** branch and user limits; PayHere path prepared for live gated checkout.
- **Live contract** always available at `/v1/docs` for partner onboarding.

---

## 17. Source of truth

| Artifact | Location |
| --- | --- |
| Routers | `apps/api/app/api/v1/` |
| Pydantic schemas | `apps/api/app/schemas/` |
| OpenAPI | `{api}/v1/openapi.json` |
| Product MVP | `mvp.md` |
| Architecture | `docs/architecture.md` |

When this document and OpenAPI disagree, **prefer OpenAPI / schema code** and update this guide.
