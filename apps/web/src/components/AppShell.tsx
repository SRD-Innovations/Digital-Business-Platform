"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import type { User } from "@/lib/api";
import { getStoredUser, getToken } from "@/lib/auth";
import { canAccessPos, canAccessSales } from "@/lib/roles";
import {
  hydrateSidebar,
  subscribeSidebar,
} from "@/lib/sidebar";
import {
  IconBox,
  IconBuilding,
  IconCart,
  IconChart,
  IconFactory,
  IconGear,
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
  group: string;
  icon: ReactNode;
  show: (user: User) => boolean;
};

const NAV: NavItem[] = [
  {
    href: "/dashboard/pos",
    label: "POS",
    group: "Sales",
    icon: <IconPos />,
    show: (u) => canAccessPos(u.role),
  },
  {
    href: "/dashboard/products",
    label: "Products",
    group: "Sales",
    icon: <IconBox />,
    show: (u) => ["owner", "manager", "cashier", "stock_keeper"].includes(u.role),
  },
  {
    href: "/dashboard/sales",
    label: "Sales",
    group: "Sales",
    icon: <IconCart />,
    show: (u) => canAccessSales(u.role),
  },
  {
    href: "/dashboard/suppliers",
    label: "Suppliers",
    group: "Stock",
    icon: <IconStore />,
    show: (u) => ["owner", "manager", "stock_keeper"].includes(u.role),
  },
  {
    href: "/dashboard/purchases",
    label: "Purchases",
    group: "Stock",
    icon: <IconTruck />,
    show: (u) => ["owner", "manager", "stock_keeper"].includes(u.role),
  },
  {
    href: "/dashboard/inventory",
    label: "Inventory",
    group: "Stock",
    icon: <IconLayers />,
    show: (u) => ["owner", "manager", "stock_keeper", "accountant"].includes(u.role),
  },
  {
    href: "/dashboard/manufacturing",
    label: "Manufacturing",
    group: "Stock",
    icon: <IconFactory />,
    show: (u) =>
      ["owner", "manager", "production_staff", "stock_keeper", "accountant"].includes(u.role),
  },
  {
    href: "/dashboard/reports/sales",
    label: "Reports",
    group: "Insights",
    icon: <IconChart />,
    show: (u) => ["owner", "manager", "accountant"].includes(u.role),
  },
  {
    href: "/dashboard/billing",
    label: "Billing",
    group: "Business",
    icon: <IconWallet />,
    show: (u) => u.role === "owner" || u.role === "manager" || u.is_platform_admin,
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
    group: "Business",
    icon: <IconGear />,
    show: (u) => u.role === "owner" || u.role === "manager",
  },
  {
    href: "/dashboard/team",
    label: "Team",
    group: "Business",
    icon: <IconUsers />,
    show: (u) => u.role === "owner" || u.role === "manager",
  },
  {
    href: "/dashboard/branches",
    label: "Branches",
    group: "Business",
    icon: <IconBuilding />,
    show: (u) => u.role === "owner" || u.role === "manager",
  },
  {
    href: "/dashboard/admin",
    label: "Admin",
    group: "Business",
    icon: <IconShield />,
    show: (u) => u.is_platform_admin,
  },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const token = getToken();
    const stored = getStoredUser();
    if (!token || !stored) {
      router.replace("/login");
      return;
    }
    setUser(stored);
  }, [router]);

  useEffect(() => {
    setCollapsed(hydrateSidebar());
    return subscribeSidebar(setCollapsed);
  }, []);

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
      <div className="app-frame" data-collapsed={collapsed ? "true" : "false"}>
        <nav className="app-nav" aria-label="Workspace" hidden={collapsed}>
          {groups.map(({ group, items }) => (
            <div key={group} className="app-nav-group">
              <p className="app-nav-label">{group}</p>
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="app-nav-link"
                  title={item.label}
                  aria-label={item.label}
                  data-active={isActive(pathname, item.href) ? "true" : "false"}
                >
                  <span className="app-nav-ico">{item.icon}</span>
                  <span className="app-nav-text">{item.label}</span>
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
