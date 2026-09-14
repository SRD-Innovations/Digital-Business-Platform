"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import type { User } from "@/lib/api";
import { getStoredUser, getToken } from "@/lib/auth";

type NavItem = {
  href: string;
  label: string;
  group: string;
  show: (user: User) => boolean;
};

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Home", group: "Overview", show: () => true },
  {
    href: "/dashboard/pos",
    label: "POS",
    group: "Sales",
    show: (u) => ["owner", "manager", "cashier"].includes(u.role),
  },
  {
    href: "/dashboard/products",
    label: "Products",
    group: "Sales",
    show: (u) => ["owner", "manager", "cashier", "stock_keeper"].includes(u.role),
  },
  {
    href: "/dashboard/sales",
    label: "Sales",
    group: "Sales",
    show: (u) => ["owner", "manager", "cashier"].includes(u.role),
  },
  {
    href: "/dashboard/suppliers",
    label: "Suppliers",
    group: "Stock",
    show: (u) => ["owner", "manager", "stock_keeper"].includes(u.role),
  },
  {
    href: "/dashboard/purchases",
    label: "Purchases",
    group: "Stock",
    show: (u) => ["owner", "manager", "stock_keeper"].includes(u.role),
  },
  {
    href: "/dashboard/inventory",
    label: "Inventory",
    group: "Stock",
    show: (u) => ["owner", "manager", "stock_keeper", "accountant"].includes(u.role),
  },
  {
    href: "/dashboard/manufacturing",
    label: "Manufacturing",
    group: "Stock",
    show: (u) =>
      ["owner", "manager", "production_staff", "stock_keeper", "accountant"].includes(u.role),
  },
  {
    href: "/dashboard/reports/sales",
    label: "Reports",
    group: "Insights",
    show: (u) => ["owner", "manager", "accountant"].includes(u.role),
  },
  {
    href: "/dashboard/billing",
    label: "Billing",
    group: "Business",
    show: (u) => u.role === "owner" || u.role === "manager" || u.is_platform_admin,
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
    group: "Business",
    show: (u) => u.role === "owner" || u.role === "manager",
  },
  {
    href: "/dashboard/team",
    label: "Team",
    group: "Business",
    show: (u) => u.role === "owner" || u.role === "manager",
  },
  {
    href: "/dashboard/branches",
    label: "Branches",
    group: "Business",
    show: (u) => u.role === "owner" || u.role === "manager",
  },
  {
    href: "/dashboard/admin",
    label: "Admin",
    group: "Business",
    show: (u) => u.is_platform_admin,
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const token = getToken();
    const stored = getStoredUser();
    if (!token || !stored) {
      router.replace("/login");
      return;
    }
    setUser(stored);
  }, [router]);

  const groups = useMemo(() => {
    if (!user) return [] as { group: string; items: NavItem[] }[];
    const visible = NAV.filter((item) => item.show(user));
    const ordered: { group: string; items: NavItem[] }[] = [];
    for (const item of visible) {
      const last = ordered[ordered.length - 1];
      if (last && last.group === item.group) last.items.push(item);
      else ordered.push({ group: item.group, items: [item] });
    }
    return ordered;
  }, [user]);

  if (!user) {
    return (
      <div className="page">
        <main className="app-main">
          <p className="lede">Loading…</p>
        </main>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="app-frame">
        <nav className="app-nav" aria-label="Workspace">
          {groups.map(({ group, items }) => (
            <div key={group} className="app-nav-group">
              <p className="app-nav-label">{group}</p>
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  data-active={isActive(pathname, item.href) ? "true" : "false"}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="app-main">{children}</div>
      </div>
    </div>
  );
}
