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
  return (await response.json()) as T;
}
