"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { apiFetch, type Branch, type User } from "@/lib/api";
import { getStoredUser, getToken } from "@/lib/auth";

function canManage(role: string): boolean {
  return role === "owner" || role === "manager";
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
    return (
      <div className="page">
        <main className="shell">
          <p className="lede">Loading…</p>
        </main>
      </div>
    );
  }

  return (
    <div className="page">
      <main className="shell">
        <p className="eyebrow">{user.tenant.name}</p>
        <h1>Dashboard</h1>
        <p className="lede">
          Signed in as {user.full_name} ({user.role.replaceAll("_", " ")}).
        </p>
        <div className="stack">
          {(user.role === "owner" || user.role === "manager" || user.role === "cashier") ? (
            <div className="panel">
              <p className="panel-label">Point of sale</p>
              <p className="muted">Shifts, split pay, park bills, returns, and print receipts.</p>
              <p className="form-foot">
                <Link href="/dashboard/pos">Open POS</Link>
                {" · "}
                <Link href="/dashboard/products">Products</Link>
                {" · "}
                <Link href="/dashboard/sales">Sales</Link>
              </p>
            </div>
          ) : null}
          {(user.role === "owner" ||
            user.role === "manager" ||
            user.role === "stock_keeper" ||
            user.role === "accountant" ||
            user.role === "production_staff") ? (
            <div className="panel">
              <p className="panel-label">ERP</p>
              <p className="muted">Suppliers, stock receipts, inventory movements, and sales totals.</p>
              <p className="form-foot">
                {(user.role === "owner" || user.role === "manager" || user.role === "stock_keeper") && (
                  <>
                    <Link href="/dashboard/suppliers">Suppliers</Link>
                    {" · "}
                    <Link href="/dashboard/purchases">Purchases</Link>
                    {" · "}
                    <Link href="/dashboard/inventory">Inventory</Link>
                  </>
                )}
                {(user.role === "owner" || user.role === "manager") && " · "}
                {(user.role === "owner" || user.role === "manager" || user.role === "accountant") && (
                  <Link href="/dashboard/reports/sales">Sales report</Link>
                )}
                {user.role === "accountant" && (
                  <>
                    {" · "}
                    <Link href="/dashboard/inventory">Inventory</Link>
                  </>
                )}
                {(user.role === "owner" ||
                  user.role === "manager" ||
                  user.role === "production_staff" ||
                  user.role === "stock_keeper" ||
                  user.role === "accountant") && (
                  <>
                    {(user.role === "owner" ||
                      user.role === "manager" ||
                      user.role === "stock_keeper" ||
                      user.role === "accountant") &&
                      " · "}
                    <Link href="/dashboard/manufacturing">Manufacturing</Link>
                  </>
                )}
              </p>
            </div>
          ) : null}
          <div className="panel">
            <p className="panel-label">Branches</p>
            <ul className="row-list">
              {(branches.length ? branches : user.branch ? [user.branch] : []).map((branch) => (
                <li key={branch.id}>
                  <span>{branch.name}</span>
                </li>
              ))}
            </ul>
            {canManage(user.role) ? (
              <p className="form-foot">
                <Link href="/dashboard/branches">Manage branches</Link>
              </p>
            ) : null}
          </div>
          {canManage(user.role) ? (
            <div className="panel">
              <p className="panel-label">Team</p>
              <p className="muted">Invite cashiers and other roles with a mobile number or join link.</p>
              <p className="form-foot">
                <Link href="/dashboard/team">Manage team</Link>
              </p>
            </div>
          ) : null}
          {(canManage(user.role) || user.is_platform_admin) ? (
            <div className="panel">
              <p className="panel-label">Billing</p>
              <p className="muted">Trial status, plan limits, and PayHere checkout stub.</p>
              <p className="form-foot">
                <Link href="/dashboard/billing">Plans & subscription</Link>
                {user.is_platform_admin ? (
                  <>
                    {" · "}
                    <Link href="/dashboard/admin">Platform admin</Link>
                  </>
                ) : null}
              </p>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
