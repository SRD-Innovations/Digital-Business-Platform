import type { User } from "@/lib/api";

/** Owner and cashier use POS; managers do not. */
export function canAccessPos(role: string): boolean {
  return role === "owner" || role === "cashier";
}

export function canAccessSales(role: string): boolean {
  return role === "owner" || role === "manager" || role === "cashier";
}

/** First screen after login — the home grid. */
export function homePathForRole(_role: string): string {
  return "/dashboard";
}

export function homePathForUser(_user: User): string {
  return "/dashboard";
}
