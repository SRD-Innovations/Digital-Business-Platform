"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ApiError, apiFetch, type SalesReport, type User } from "@/lib/api";
import { getStoredUser, getToken } from "@/lib/auth";

function canView(role: string): boolean {
  return role === "owner" || role === "manager" || role === "accountant";
}

export default function SalesReportPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [report, setReport] = useState<SalesReport | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getToken();
    const stored = getStoredUser();
    if (!token || !stored) {
      router.replace("/login");
      return;
    }
    if (!canView(stored.role)) {
      router.replace("/dashboard");
      return;
    }
    setUser(stored);
    apiFetch<SalesReport>("/v1/reports/sales", { token })
      .then(setReport)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load report"));
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
      <main className="shell shell-wide">
        <p className="eyebrow">{user.tenant.name}</p>
        <h1>Sales report</h1>
        <p className="lede">
          Completed sales totals. <Link href="/dashboard/sales">Sale history</Link>
        </p>
        {error ? <p className="form-error">{error}</p> : null}
        {report ? (
          <div className="stack">
            <div className="panel">
              <p className="panel-label">Summary</p>
              <p>
                {report.completed_sales} sales · Rs {report.gross_total}
              </p>
            </div>
            <div className="panel">
              <p className="panel-label">By payment</p>
              {report.by_payment.length ? (
                <ul className="row-list">
                  {report.by_payment.map((row) => (
                    <li key={row.method}>
                      <span>{row.method}</span>
                      <span>Rs {row.amount}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No payments yet</p>
              )}
            </div>
            <div className="panel">
              <p className="panel-label">Top products</p>
              {report.top_products.length ? (
                <ul className="row-list">
                  {report.top_products.map((row) => (
                    <li key={`${row.product_id}-${row.product_name}`}>
                      <span>
                        {row.product_name}
                        <span className="muted"> · qty {row.quantity}</span>
                      </span>
                      <span>Rs {row.revenue}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No product sales yet</p>
              )}
            </div>
            <div className="panel">
              <p className="panel-label">By day</p>
              {report.by_day.length ? (
                <ul className="row-list">
                  {report.by_day.map((row) => (
                    <li key={row.day}>
                      <span>
                        {row.day}
                        <span className="muted"> · {row.sale_count} sales</span>
                      </span>
                      <span>Rs {row.total}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No daily totals yet</p>
              )}
            </div>
          </div>
        ) : !error ? (
          <p className="muted">Loading report…</p>
        ) : null}
      </main>
    </div>
  );
}
