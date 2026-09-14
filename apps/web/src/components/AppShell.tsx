"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import type { User } from "@/lib/api";
import { getStoredUser, getToken } from "@/lib/auth";
import {
  IconBox,
  IconBuilding,
  IconCart,
  IconChart,
  IconFactory,
  IconGear,
  IconHome,
  IconLayers,
  IconPos,
  IconShield,
  IconStore,
  IconTruck,
  IconUsers,
  IconWallet,
} from "@/components/Icons";

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  show: (user: User) => boolean;
};

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: <IconHome />, show: () => true },
  {
    href: "/dashboard/pos",
    label: "POS",
    icon: <IconPos />,
    show: (u) => ["owner", "manager", "cashier"].includes(u.role),
  },
  {
    href: "/dashboard/products",
    label: "Products",
    icon: <IconBox />,
    show: (u) => ["owner", "manager", "cashier", "stock_keeper"].includes(u.role),
  },
  {
    href: "/dashboard/sales",
    label: "Sales",
    icon: <IconCart />,
    show: (u) => ["owner", "manager", "cashier"].includes(u.role),
  },
  {
    href: "/dashboard/suppliers",
    label: "Suppliers",
    icon: <IconStore />,
    show: (u) => ["owner", "manager", "stock_keeper"].includes(u.role),
  },
  {
    href: "/dashboard/purchases",
    label: "Purchases",
    icon: <IconTruck />,
    show: (u) => ["owner", "manager", "stock_keeper"].includes(u.role),
  },
  {
    href: "/dashboard/inventory",
    label: "Inventory",
    icon: <IconLayers />,
    show: (u) => ["owner", "manager", "stock_keeper", "accountant"].includes(u.role),
  },
  {
    href: "/dashboard/manufacturing",
    label: "Manufacturing",
    icon: <IconFactory />,
    show: (u) =>
      ["owner", "manager", "production_staff", "stock_keeper", "accountant"].includes(u.role),
  },
  {
    href: "/dashboard/reports/sales",
    label: "Reports",
    icon: <IconChart />,
    show: (u) => ["owner", "manager", "accountant"].includes(u.role),
  },
  {
    href: "/dashboard/billing",
    label: "Billing",
    icon: <IconWallet />,
    show: (u) => u.role === "owner" || u.role === "manager" || u.is_platform_admin,
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
    icon: <IconGear />,
    show: (u) => u.role === "owner" || u.role === "manager",
  },
  {
    href: "/dashboard/team",
    label: "Team",
    icon: <IconUsers />,
    show: (u) => u.role === "owner" || u.role === "manager",
  },
  {
    href: "/dashboard/branches",
    label: "Branches",
    icon: <IconBuilding />,
    show: (u) => u.role === "owner" || u.role === "manager",
  },
  {
    href: "/dashboard/admin",
    label: "Admin",
    icon: <IconShield />,
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

  const items = useMemo(() => (user ? NAV.filter((item) => item.show(user)) : []), [user]);

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
        <nav className="app-nav app-nav-icons" aria-label="Workspace">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="app-nav-icon"
              title={item.label}
              aria-label={item.label}
              data-active={isActive(pathname, item.href) ? "true" : "false"}
            >
              {item.icon}
            </Link>
          ))}
        </nav>
        <div className="app-main">{children}</div>
      </div>
    </div>
  );
}
