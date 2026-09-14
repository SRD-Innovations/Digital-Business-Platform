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
  tenant: Tenant;
  branch: Branch | null;
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
  is_active: boolean;
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
