import type { ComponentType } from "react";

import type { User } from "@/lib/api";
import { canAccessPos, canAccessSales } from "@/lib/roles";
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

export type AppNavItem = {
  href: string;
  label: string;
  group: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  show: (user: User) => boolean;
  featured?: boolean;
};

export const APP_NAV: AppNavItem[] = [
  {
    href: "/dashboard",
    label: "Home",
    group: "Sales",
    description: "Menu and today’s numbers",
    icon: IconHome,
    show: () => true,
  },
  {
    href: "/dashboard/pos",
    label: "POS",
    group: "Sales",
    description: "Checkout, park, and take payment",
    icon: IconPos,
    featured: true,
    show: (u) => canAccessPos(u.role),
  },
  {
    href: "/dashboard/products",
    label: "Products",
    group: "Sales",
    description: "Catalog, SKUs, and pricing",
    icon: IconBox,
    show: (u) => ["owner", "manager", "cashier", "stock_keeper"].includes(u.role),
  },
  {
    href: "/dashboard/sales",
    label: "Sales",
    group: "Sales",
    description: "Receipts, voids, and returns",
    icon: IconCart,
    show: (u) => canAccessSales(u.role),
  },
  {
    href: "/dashboard/suppliers",
    label: "Suppliers",
    group: "Stock",
    description: "Vendor records",
    icon: IconStore,
    show: (u) => ["owner", "manager", "stock_keeper"].includes(u.role),
  },
  {
    href: "/dashboard/purchases",
    label: "Purchases",
    group: "Stock",
    description: "Goods received and GRN",
    icon: IconTruck,
    show: (u) => ["owner", "manager", "stock_keeper"].includes(u.role),
  },
  {
    href: "/dashboard/inventory",
    label: "Inventory",
    group: "Stock",
    description: "On-hand stock and adjustments",
    icon: IconLayers,
    show: (u) => ["owner", "manager", "stock_keeper", "accountant"].includes(u.role),
  },
  {
    href: "/dashboard/manufacturing",
    label: "Manufacturing",
    group: "Stock",
    description: "BOM, yield, and wastage",
    icon: IconFactory,
    show: (u) =>
      ["owner", "manager", "production_staff", "stock_keeper", "accountant"].includes(u.role),
  },
  {
    href: "/dashboard/reports/sales",
    label: "Reports",
    group: "Insights",
    description: "Totals, tender mix, top SKUs",
    icon: IconChart,
    show: (u) => ["owner", "manager", "accountant"].includes(u.role),
  },
  {
    href: "/dashboard/billing",
    label: "Billing",
    group: "Business",
    description: "Plan and payments",
    icon: IconWallet,
    show: (u) => u.role === "owner" || u.role === "manager" || u.is_platform_admin,
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
    group: "Business",
    description: "Business profile and defaults",
    icon: IconGear,
    show: (u) => u.role === "owner" || u.role === "manager",
  },
  {
    href: "/dashboard/team",
    label: "Team",
    group: "Business",
    description: "Invite staff by mobile number",
    icon: IconUsers,
    show: (u) => u.role === "owner" || u.role === "manager",
  },
  {
    href: "/dashboard/branches",
    label: "Branches",
    group: "Business",
    description: "Locations and assignments",
    icon: IconBuilding,
    show: (u) => u.role === "owner" || u.role === "manager",
  },
  {
    href: "/dashboard/admin",
    label: "Admin",
    group: "Business",
    description: "Platform administration",
    icon: IconShield,
    show: (u) => u.is_platform_admin,
  },
];

export function navForUser(user: User): AppNavItem[] {
  return APP_NAV.filter((item) => item.show(user));
}

export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function moduleForPath(pathname: string): "trade" | "manufacturing" | "none" {
  if (pathname.startsWith("/dashboard/manufacturing")) return "manufacturing";
  if (
    pathname.startsWith("/dashboard/products") ||
    pathname.startsWith("/dashboard/inventory") ||
    pathname.startsWith("/dashboard/purchases") ||
    pathname.startsWith("/dashboard/suppliers")
  ) {
    return "trade";
  }
  return "none";
}
