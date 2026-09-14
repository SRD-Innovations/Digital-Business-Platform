"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { apiFetch, type Branch, type User } from "@/lib/api";
import { getStoredUser, getToken } from "@/lib/auth";

function canManage(role: string): boolean {
  return role === "owner" || role === "manager";
}

function canPos(role: string): boolean {
  return role === "owner" || role === "manager" || role === "cashier";
}

function canStock(role: string): boolean {
  return role === "owner" || role === "manager" || role === "stock_keeper";
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);

  useEffect(() => {
    const token = getToken();
    const stored = getStoredUser();
    if (!token || !stored) {
      router.replace("/login");
      return;
    }
    setUser(stored);
    apiFetch<Branch[]>("/v1/branches", { token }).then(setBranches).catch(() => undefined);
  }, [router]);

  if (!user) {
    return <p className="lede">Loading…</p>;
  }

  const branchNames = (branches.length ? branches : user.branch ? [user.branch] : [])
    .map((b) => b.name)
    .join(" · ");

  return (
    <>
      <header className="dash-hero">
        <p className="eyebrow">{user.tenant.name}</p>
        <h1>Good to see you, {user.full_name.split(" ")[0]}</h1>
        <p className="lede">
          Signed in as {user.role.replaceAll("_", " ")}
          {branchNames ? ` · ${branchNames}` : ""}. Pick a workspace below — POS is ready when the
          counter is.
        </p>
      </header>

      <div className="dash-grid">
        {canPos(user.role) ? (
          <Link href="/dashboard/pos" className="module-link module-link--primary">
            <strong>Open POS</strong>
            <span>Shifts, split pay, park bills, and print receipts.</span>
          </Link>
        ) : null}
        {canPos(user.role) || user.role === "stock_keeper" ? (
          <Link href="/dashboard/products" className="module-link">
            <strong>Products</strong>
            <span>Catalogue, barcodes, wholesale tiers, and batches.</span>
          </Link>
        ) : null}
        {canPos(user.role) ? (
          <Link href="/dashboard/sales" className="module-link">
            <strong>Sales</strong>
            <span>Reprint, void, and return completed receipts.</span>
          </Link>
        ) : null}
        {canStock(user.role) ? (
          <Link href="/dashboard/inventory" className="module-link">
            <strong>Inventory</strong>
            <span>Movements and stock adjustments.</span>
          </Link>
        ) : null}
        {canStock(user.role) ? (
          <Link href="/dashboard/purchases" className="module-link">
            <strong>Purchases</strong>
            <span>Receive supplier stock into the branch.</span>
          </Link>
        ) : null}
        {["owner", "manager", "production_staff", "stock_keeper", "accountant"].includes(
          user.role,
        ) ? (
          <Link href="/dashboard/manufacturing" className="module-link">
            <strong>Manufacturing</strong>
            <span>BOMs, production runs, yield and costing.</span>
          </Link>
        ) : null}
        {["owner", "manager", "accountant"].includes(user.role) ? (
          <Link href="/dashboard/reports/sales" className="module-link">
            <strong>Sales report</strong>
            <span>Day totals, top products, and payment mix.</span>
          </Link>
        ) : null}
        {canManage(user.role) ? (
          <Link href="/dashboard/settings" className="module-link">
            <strong>Business settings</strong>
            <span>TIN, VAT, and address for printed receipts.</span>
          </Link>
        ) : null}
        {canManage(user.role) ? (
          <Link href="/dashboard/team" className="module-link">
            <strong>Team</strong>
            <span>Invite cashiers and staff by phone or link.</span>
          </Link>
        ) : null}
        {canManage(user.role) || user.is_platform_admin ? (
          <Link href="/dashboard/billing" className="module-link">
            <strong>Billing</strong>
            <span>Trial, plans, and subscription limits.</span>
          </Link>
        ) : null}
      </div>
    </>
  );
}
