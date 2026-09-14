"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { apiFetch, type Branch, type User } from "@/lib/api";
import { getStoredUser, getToken } from "@/lib/auth";
import {
  IconBox,
  IconCart,
  IconChart,
  IconFactory,
  IconGear,
  IconPos,
  IconTruck,
  IconUsers,
  IconWallet,
} from "@/components/Icons";

function canManage(role: string): boolean {
  return role === "owner" || role === "manager";
}

function canPos(role: string): boolean {
  return role === "owner" || role === "manager" || role === "cashier";
}

function canStock(role: string): boolean {
  return role === "owner" || role === "manager" || role === "stock_keeper";
}

function Module({
  href,
  title,
  icon,
  primary,
}: {
  href: string;
  title: string;
  icon: ReactNode;
  primary?: boolean;
}) {
  return (
    <Link href={href} className={`module-link${primary ? " module-link--primary" : ""}`}>
      <span className="module-ico">{icon}</span>
      <strong>{title}</strong>
    </Link>
  );
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

  const branchLabel = (branches.length ? branches : user.branch ? [user.branch] : [])
    .map((b) => b.name)
    .join(" · ");

  return (
    <>
      <header className="dash-hero">
        <p className="eyebrow">{user.role.replaceAll("_", " ")}</p>
        <h1>{user.full_name.split(" ")[0]}</h1>
        {branchLabel ? <p className="muted">{branchLabel}</p> : null}
      </header>

      <div className="dash-grid">
        {canPos(user.role) ? (
          <Module href="/dashboard/pos" title="POS" icon={<IconPos />} primary />
        ) : null}
        {canPos(user.role) || user.role === "stock_keeper" ? (
          <Module href="/dashboard/products" title="Products" icon={<IconBox />} />
        ) : null}
        {canPos(user.role) ? (
          <Module href="/dashboard/sales" title="Sales" icon={<IconCart />} />
        ) : null}
        {canStock(user.role) ? (
          <Module href="/dashboard/inventory" title="Inventory" icon={<IconBox />} />
        ) : null}
        {canStock(user.role) ? (
          <Module href="/dashboard/purchases" title="Purchases" icon={<IconTruck />} />
        ) : null}
        {["owner", "manager", "production_staff", "stock_keeper", "accountant"].includes(
          user.role,
        ) ? (
          <Module href="/dashboard/manufacturing" title="Manufacturing" icon={<IconFactory />} />
        ) : null}
        {["owner", "manager", "accountant"].includes(user.role) ? (
          <Module href="/dashboard/reports/sales" title="Reports" icon={<IconChart />} />
        ) : null}
        {canManage(user.role) ? (
          <Module href="/dashboard/settings" title="Settings" icon={<IconGear />} />
        ) : null}
        {canManage(user.role) ? (
          <Module href="/dashboard/team" title="Team" icon={<IconUsers />} />
        ) : null}
        {canManage(user.role) || user.is_platform_admin ? (
          <Module href="/dashboard/billing" title="Billing" icon={<IconWallet />} />
        ) : null}
      </div>
    </>
  );
}
