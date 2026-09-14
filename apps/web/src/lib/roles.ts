import type { User } from "@/lib/api";

/** Owner and cashier use POS; managers do not. */
export function canAccessPos(role: string): boolean {
  return role === "owner" || role === "cashier";
}

export function canAccessSales(role: string): boolean {
  return role === "owner" || role === "manager" || role === "cashier";
}

/** First screen after login / visiting /dashboard. */
export function homePathForRole(role: string): string {
  switch (role) {
    case "owner":
    case "cashier":
      return "/dashboard/pos";
    case "manager":
      return "/dashboard/sales";
    case "stock_keeper":
      return "/dashboard/inventory";
    case "accountant":
      return "/dashboard/reports/sales";
    case "production_staff":
      return "/dashboard/manufacturing";
    default:
      return "/dashboard/products";
  }
}

export function homePathForUser(user: User): string {
  if (user.is_platform_admin && !canAccessPos(user.role) && user.role !== "manager") {
    return "/dashboard/admin";
  }
  return homePathForRole(user.role);
}
