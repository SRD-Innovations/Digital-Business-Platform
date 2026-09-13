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
  email: string;
  full_name: string;
  role: string;
  tenant: Tenant;
  branch: Branch | null;
};

export type AuthResponse = {
  access_token: string;
  token_type: string;
  user: User;
};

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
  const response = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
  if (!response.ok) {
    let detail = "Request failed";
    try {
      const body = (await response.json()) as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(response.status, detail);
  }
  return (await response.json()) as T;
}
