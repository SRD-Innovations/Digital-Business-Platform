# Business Management Platform (EPOS + ERP) — MVP Document
**Sri Lanka's first target application — a digital platform for businesses, not just a POS**

*Last updated: September 2026*

---

## 1. Product Vision

A single web-based, role-based **business management platform**, built around a POS-driven core but designed from the ground up as a full digital operating system for a business — not a POS tool with extras bolted on.

**Origin point:** founding team implemented a POS for a rice mill (production/manufacturing). The product is intentionally horizontal — built to serve many business types through a **modular core + industry module families**, rather than staying locked to one vertical.

**Platform for MVP: Web only, offline-first.** No native mobile or desktop app in this phase — shelved for later, not discarded.

**Business model:** SaaS subscription.
- Free trial: 2–3 weeks
- Billing: monthly or yearly (yearly discount, e.g. "2 months free")
- Tiers gated by branches / users / enabled module families — exact pricing not yet finalized

---

## 2. Target Audience

The platform is built to eventually serve a wide range of business types:

Retail shops · Wholesale shops · Pharmacies · Restaurants · Hotels · Service businesses (salons, repair shops, consultancies) · Garment factories · Production/manufacturing (mills) · Self-employed / sole traders

**These cluster into module families** rather than needing a separate build per business type:

| Family | Business types | Shared operational pattern |
|---|---|---|
| **Trade** | Retail, Wholesale, Pharmacy | Sell physical stock, inventory-driven; differ mainly in pricing tiers (wholesale) and regulatory tracking (pharmacy batch/expiry, prescriptions) |
| **Manufacturing** | Mills, Garment factories, general production | Raw material → finished goods, bill of materials, yield/wastage tracking, batch costing |
| **Hospitality** | Restaurants, Hotels | Table/room-based operations, booking + order flow |
| **Services** | Salons, repair shops, consultancies | Appointment/job-based billing, little to no physical inventory |
| **Self-employed / Solo** | Freelancers, sole traders | Core platform only, minimal configuration — lightest possible tier |

**Common traits across all segments, driving core design decisions:**
- Price-sensitive — competing against "a notebook and a calculator," not enterprise software
- Low tolerance for complexity — daily operator is often not tech-trained; onboarding must be near-zero-training
- **MVP UI language is English only.** Sinhala/Tamil remain important for Sri Lanka and are deferred post-MVP
- Connectivity is unreliable, not just slow — power cuts and patchy mobile data are routine, especially outside Colombo. This is why offline-first is the platform's core differentiator, not a technical footnote
- Trust matters more than feature count — reliability and simplicity win more customers early than a long feature list

---

## 3. MVP Scope

**Positioning vs. build, kept deliberately separate:**
- **Position** the platform from day one as built for all the business types above
- **Build** only two module families first, chosen because together they cover the most ground with the least duplicated work

### In scope for MVP
- Core platform (roles, branches, auth; English UI; LKR)
- POS module
- ERP core (inventory, purchasing, basic accounting, reporting)
- **Trade family module** (covers Retail, Wholesale, Pharmacy)
- **Manufacturing family module** (covers Mills, Garment factories, general production)
- **Self-employed / Solo tier** — core platform only, no module — essentially free to support since no new build is required
- Web app only, offline-first

### Explicitly out of scope for MVP
- Sinhala / Tamil UI and receipts (English only for MVP; multilingual post-MVP)
- Native mobile app (Flutter) and desktop app (Electron) — shelved
- Hospitality module family (Restaurants, Hotels) — Phase 2, genuinely different booking/table/room logic deserves dedicated build time
- Services module family (Salons, repair shops, consultancies) — Phase 2/3, appointment/job-based logic
- Marketplace (vendor/buyer) — future premium feature, needs an active tenant base first
- Payment-processing revenue share, analytics add-ons, API access tier, featured listings — future monetization layers beyond the base subscription

---

## 4. Feature Set

### 4.1 Core Platform

**Role-based access control**
- Predefined roles: Owner/Admin, Manager, Cashier, Stock Keeper, Accountant, Production Staff
- Custom roles with granular, per-module permissions
- Multi-branch support — per-branch stock and staff

**Locale & payments (MVP)**
- English UI and receipts only
- LKR currency; Sri Lankan VAT/NBT/SVAT handling (formats can deepen in pilot)
- Local payment gateway integration (PayHere first; FriMi, LankaPay, Genie, bank QR later)
- IRD-compliant invoice/tax formats (pilot / hardening)

**Locale (post-MVP)**
- Sinhala and Tamil UI and receipts

**Notifications & audit**
- Low stock, payment due, shift-close alerts (SMS / WhatsApp / push)
- Full audit trail — who changed what, when

### 4.2 POS Module

- Fast checkout: barcode scan, search, quick-keys, held/parked bills
- Split payments on one bill (cash + card + credit)
- Discounts, promotions, loyalty points
- Returns / refunds / exchanges with approval workflow
- Shift and cash-drawer reconciliation
- Receipt printing (thermal, via browser hardware APIs) + digital receipt (SMS/email)
- Customer profiles & purchase history

### 4.3 ERP Core

- **Inventory**: stock levels, batch/expiry tracking, inter-branch transfer, reorder alerts
- **Purchasing**: supplier management, purchase orders, goods-received notes
- **Accounting basics**: sales/purchase ledgers, expense tracking, P&L, VAT reports, bank reconciliation
- **Reporting & dashboards**: sales trends, best-sellers, staff performance, branch comparison

### 4.4 Trade Family Module (Retail / Wholesale / Pharmacy)

- Barcode-heavy, high-SKU catalog handling
- Supplier price lists
- Wholesale pricing tiers (bulk/quantity-based pricing)
- Pharmacy configuration: batch/expiry-critical tracking, prescription record-keeping, regulatory reporting

### 4.5 Manufacturing Family Module (Mills / Garment / General Production)

- Bill of materials (BOM)
- Raw material → finished goods conversion tracking
- Yield / wastage percentage tracking
- Batch costing

### 4.6 Subscription Layer

- Free trial (2–3 weeks)
- Monthly and yearly billing
- Plan tiers by branches / users / module families enabled (Self-employed tier included as the lightest option)
- Internal super-admin panel for tenant management, support, billing oversight

---

## 5. Draft Plan Structure

*(numbers/pricing not final — shape only, for review)*

| | **Trial** | **Solo** | **Starter** | **Standard** | **Premium** |
|---|---|---|---|---|---|
| Target | Anyone, 2–3 weeks | Self-employed | Single shop/mill | Small chain | Larger operator |
| Branches | 1 | 1 | 1 | Up to 3 | Unlimited |
| Users | Up to 2 | 1–2 | Up to 3 | Up to 10 | Unlimited |
| Module family | Any 1 | None (core only) | 1 included | Both included | Both + priority access to future families |
| Multi-branch stock transfer | ❌ | ❌ | ❌ | ✅ | ✅ |
| Advanced reporting | ❌ | Basic | Basic | ✅ | ✅ + export |
| Support | Self-serve | Email | Email | Email + chat | Priority + onboarding |

*Whether Trade/Manufacturing modules are bundled or priced separately per tier is still an open decision.*

---

## 6. Technology Stack

| Layer | Choice | Why |
|---|---|---|
| **Backend / API** | **FastAPI** (Python) | API-first, fast to build, auto OpenAPI docs, opens the door to analytics/forecasting later |
| **Web (only platform)** | **Next.js** (TypeScript, React) | Serves both admin/back-office and the POS screen |
| **JS runtime / packages** | **Bun** | Fast installs and scripts for the Next.js app in local dev and CI |
| **Database** | **Supabase** (Postgres) | Relational data fits Postgres (inventory, ledgers, multi-branch stock); file storage and optional Auth save early build time. FastAPI stays the only API surface |
| **Web hosting** | **Vercel** | Native Next.js hosting and PR preview deploys |
| **API hosting** | **Railway** | FastAPI process, env vars, and staging without standing up AWS first |
| **CI** | **GitHub Actions** | Lint / typecheck / test on pull requests into `develop` |
| **Later infra** | AWS (`ap-south-1`, Mumbai) or a local LK host; Cloudflare in front | Lowest latency to Sri Lanka once traffic justifies it — not required to start the MVP |

**API style:** REST, versioned (`/v1/...`), documented via OpenAPI/Swagger.

Working detail for this repo: [`docs/stack.md`](./docs/stack.md) and [`docs/deployment.md`](./docs/deployment.md).

---

## 7. Offline-First Strategy (Web)

**Local storage:** IndexedDB via Dexie.js or PGlite (Postgres in-browser via WASM); service worker so the app shell loads with zero connection.

**Hardware access:** WebUSB / WebHID / WebBluetooth for barcode scanners and thermal printers on Chromium browsers — accepted as a stated device constraint (weak Safari support).

**Data safety:** periodic background sync, visible "last synced" indicator, warning before risky browser actions (e.g. clearing browser data).

**Sync layer:** hand-rolled sync queue for MVP — operation log per device (timestamp + device/user ID), pushed to FastAPI once online, last-write-wins or field-level conflict resolution with logging for ambiguous cases. Local schema designed so migration to a managed tool (PowerSync, ElectricSQL) is possible later without a rewrite.

---

## 8. Development Roadmap (Phased)

1. **Foundation & infrastructure** — repo, CI/CD, Supabase project, FastAPI + Next.js skeletons, dev/staging environments
2. **Core platform: auth, roles, multi-tenancy** — multi-tenant DB design, JWT auth, RBAC guards, branch management, user invites
3. **POS module (online-first build)** — checkout, split payments, discounts, returns, shift/cash reconciliation
4. **Offline-first layer** — IndexedDB/PGlite, service worker, sync queue, conflict resolution, offline status UI *(highest-risk phase — protect this timeline)*
5. **ERP core** — inventory, purchasing, accounting basics, reporting dashboards
6. **Module families: Trade & Manufacturing** — vertical-specific logic layered on the stable core
7. **Subscription & billing layer** — trial logic, plan tiers, payment gateway integration, super-admin panel
8. **QA & pilot launch** — English-only UI polish, IRD tax formats, real hardware testing, pilot with a real Trade customer and a real Manufacturing customer before wider launch

---

## 9. Post-MVP Roadmap

- Sinhala / Tamil UI and receipts
- Hospitality module family (Restaurants, Hotels)
- Services module family (Salons, repair shops, consultancies)
- Marketplace (vendor/buyer), commission-based revenue
- Payment processing revenue share
- Advanced analytics/forecasting add-on
- API access tier for external integrations
- Native mobile app (Flutter) and desktop app (Electron), if/when demand justifies a second codebase

---

## 10. Open Items

- Final subscription pricing (tiers, per-branch/per-user cost, yearly discount %)
- Whether Trade/Manufacturing modules are bundled or priced as separate add-ons
- Whether trial requires a card upfront
- Exact conflict-resolution rules for the sync queue
- Multi-tenant DB design: shared DB with `tenant_id` vs. schema-per-tenant