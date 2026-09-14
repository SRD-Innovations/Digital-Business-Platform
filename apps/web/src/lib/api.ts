export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "https://digital-business-platform.onrender.com";

export type Tenant = {
  id: string;
  name: string;
  slug: string;
};

export type Branch = {
  id: string;
  name: string;
};

export type User = {
  id: string;
  email: string | null;
  phone: string | null;
  full_name: string;
  role: string;
  is_platform_admin: boolean;
  tenant: Tenant;
  branch: Branch | null;
};

export type Plan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  max_branches: number;
  max_users: number;
  includes_trade: boolean;
  includes_manufacturing: boolean;
  price_monthly_lkr: string;
  price_yearly_lkr: string;
};

export type Subscription = {
  id: string;
  status: string;
  billing_interval: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  plan: Plan;
};

export type AdminTenant = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  subscription_status: string | null;
  plan_code: string | null;
};

export type Member = {
  id: string;
  email: string | null;
  phone: string | null;
  full_name: string;
  role: string;
  branch: Branch | null;
};

export type Invite = {
  id: string;
  email: string | null;
  phone: string | null;
  role: string;
  branch: Branch | null;
  expires_at: string;
  accepted_at: string | null;
};

export type InviteCreated = {
  invite: Invite;
  token: string;
  join_path: string;
};

export type AuthResponse = {
  access_token: string;
  token_type: string;
  user: User;
};

export type Product = {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  unit_price: string;
  stock_on_hand: string;
  track_batches: boolean;
  is_active: boolean;
};

export type PriceTier = {
  id: string;
  product_id: string;
  min_qty: string;
  unit_price: string;
};

export type ProductBatch = {
  id: string;
  product_id: string;
  batch_code: string;
  expiry_date: string | null;
  quantity: string;
};

export type SupplierPrice = {
  id: string;
  supplier_id: string;
  product_id: string;
  unit_cost: string;
};

export type SaleLine = {
  id: string;
  product_id: string | null;
  product_name: string;
  quantity: string;
  unit_price: string;
  line_total: string;
};

export type SalePayment = {
  id: string;
  method: string;
  amount: string;
};

export type Sale = {
  id: string;
  receipt_number: string;
  status: string;
  branch_id: string | null;
  cashier_user_id: string;
  shift_id: string | null;
  refund_of_sale_id: string | null;
  client_op_id: string | null;
  device_id: string | null;
  subtotal: string;
  discount_total: string;
  total: string;
  note: string | null;
  created_at: string;
  lines: SaleLine[];
  payments: SalePayment[];
};

export type Shift = {
  id: string;
  branch_id: string | null;
  opened_by_user_id: string;
  closed_by_user_id: string | null;
  opening_cash: string;
  closing_cash: string | null;
  expected_cash: string | null;
  cash_sales_total: string;
  card_sales_total: string;
  credit_sales_total: string;
  status: string;
  opened_at: string;
  closed_at: string | null;
  note: string | null;
  variance: string | null;
};

export type ParkedBill = {
  id: string;
  label: string;
  branch_id: string | null;
  cashier_user_id: string;
  cart_json: {
    discount_total?: string;
    note?: string | null;
    lines?: { product_id: string; quantity: string }[];
  };
  created_at: string;
};

export type Supplier = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  note: string | null;
  is_active: boolean;
  created_at: string;
};

export type PurchaseReceiptLine = {
  id: string;
  product_id: string;
  quantity: string;
  unit_cost: string;
};

export type PurchaseReceipt = {
  id: string;
  supplier_id: string;
  branch_id: string | null;
  received_by_user_id: string;
  status: string;
  note: string | null;
  received_at: string;
  lines: PurchaseReceiptLine[];
};

export type InventoryMovement = {
  id: string;
  product_id: string;
  quantity: string;
  reason: string;
  ref_type: string | null;
  ref_id: string | null;
  note: string | null;
  created_by_user_id: string | null;
  created_at: string;
};

export type SalesReport = {
  from_date: string | null;
  to_date: string | null;
  completed_sales: number;
  gross_total: string;
  by_day: { day: string; sale_count: number; total: string }[];
  top_products: {
    product_id: string | null;
    product_name: string;
    quantity: string;
    revenue: string;
  }[];
  by_payment: { method: string; amount: string }[];
};

export type BomLine = {
  id: string;
  component_product_id: string;
  quantity_per_output: string;
};

export type Bom = {
  id: string;
  name: string;
  finished_product_id: string;
  expected_yield_pct: string;
  is_active: boolean;
  lines: BomLine[];
};

export type ProductionRunLine = {
  id: string;
  component_product_id: string;
  quantity: string;
  unit_cost: string;
  line_cost: string;
};

export type ProductionRun = {
  id: string;
  bom_id: string;
  finished_product_id: string;
  planned_output_qty: string;
  actual_output_qty: string;
  yield_pct: string;
  wastage_pct: string;
  unit_cost: string;
  total_component_cost: string;
  status: string;
  note: string | null;
  created_by_user_id: string;
  created_at: string;
  lines: ProductionRunLine[];
};

export const STAFF_ROLES = [
  "manager",
  "cashier",
  "stock_keeper",
  "accountant",
  "production_staff",
] as const;

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, headers, ...rest } = options;
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    });
  } catch {
    throw new ApiError(0, `Cannot reach the API at ${API_URL}`);
  }
  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { detail?: unknown };
      if (typeof body.detail === "string") {
        detail = body.detail;
      } else if (Array.isArray(body.detail)) {
        detail = body.detail
          .map((item) =>
            typeof item === "object" && item && "msg" in item
              ? String((item as { msg: string }).msg)
              : JSON.stringify(item),
          )
          .join("; ");
      }
    } catch {
      /* ignore */
    }
    throw new ApiError(response.status, detail);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  const text = await response.text();
  if (!text) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}
