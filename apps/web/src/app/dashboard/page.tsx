"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  ApiError,
  apiFetch,
  type Product,
  type PurchaseReceipt,
  type SalesReport,
  type User,
} from "@/lib/api";
import { getStoredUser, getToken } from "@/lib/auth";
import { navForUser } from "@/lib/nav";
import { stockTone } from "@/lib/stock";
import { IconChart, IconLayers, IconTruck } from "@/components/Icons";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [report, setReport] = useState<SalesReport | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [receipts, setReceipts] = useState<PurchaseReceipt[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getToken();
    const stored = getStoredUser();
    if (!token || !stored) {
      router.replace("/login");
      return;
    }
    setUser(stored);
    if (stored.role !== "owner" && stored.role !== "manager") return;
    Promise.all([
      apiFetch<SalesReport>("/v1/reports/sales", { token }),
      apiFetch<Product[]>("/v1/products?active_only=false", { token }),
      apiFetch<PurchaseReceipt[]>("/v1/purchases/receipts", { token }),
    ])
      .then(([nextReport, nextProducts, nextReceipts]) => {
        setReport(nextReport);
        setProducts(nextProducts);
        setReceipts(nextReceipts);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load dashboard"));
  }, [router]);

  const menu = useMemo(
    () => (user ? navForUser(user).filter((item) => item.href !== "/dashboard") : []),
    [user],
  );

  if (!user) {
    return <p className="lede">Loading…</p>;
  }

  const showMetrics = user.role === "owner" || user.role === "manager";
  const today = report?.by_day.find((row) => row.day === todayKey());
  const lowStock = products.filter((product) => stockTone(product.stock_on_hand) !== "in-stock");
  const pendingPurchases = receipts.length;

  return (
    <main className="shell shell-wide shell-home" aria-label="Home">
      {error ? <p className="form-error">{error}</p> : null}

      {showMetrics ? (
        <div className="status-board">
          <Link href="/dashboard/reports/sales" className="status-card" data-tone="success">
            <span className="status-card-ico" aria-hidden>
              <IconChart />
            </span>
            <div className="status-card-body">
              <span>Today’s sales</span>
              <p>Rs {today?.total ?? "0.00"}</p>
              <em>{today?.sale_count ?? 0} receipts</em>
            </div>
          </Link>
          <Link
            href="/dashboard/inventory"
            className="status-card"
            data-tone={lowStock.length ? "warning" : "ok"}
          >
            <span className="status-card-ico" aria-hidden>
              <IconLayers />
            </span>
            <div className="status-card-body">
              <span>Low / out of stock</span>
              <p>{lowStock.length}</p>
              <em>of {products.length} SKUs</em>
            </div>
          </Link>
          <Link href="/dashboard/purchases" className="status-card" data-tone="info">
            <span className="status-card-ico" aria-hidden>
              <IconTruck />
            </span>
            <div className="status-card-body">
              <span>Purchase receipts</span>
              <p>{pendingPurchases}</p>
              <em>recorded deliveries</em>
            </div>
          </Link>
        </div>
      ) : null}

      <section className="home-menu" aria-label="Modules">
        {menu.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="home-menu-tile"
              title={item.description}
              data-featured={item.featured ? "true" : "false"}
            >
              <span className="home-menu-ico" aria-hidden>
                <Icon />
              </span>
              <strong>{item.label}</strong>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
