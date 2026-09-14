"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ApiError, apiFetch, type Sale, type User } from "@/lib/api";
import { getStoredUser, getToken } from "@/lib/auth";

function canUsePos(role: string): boolean {
  return role === "owner" || role === "manager" || role === "cashier";
}

function canVoid(role: string): boolean {
  return role === "owner" || role === "manager";
}

function printReceipt(sale: Sale, business: string) {
  const win = window.open("", "receipt", "width=360,height=640");
  if (!win) return;
  const lines = sale.lines
    .map(
      (line) =>
        `<tr><td>${line.product_name}</td><td>${line.quantity}</td><td>${line.unit_price}</td><td>${line.line_total}</td></tr>`,
    )
    .join("");
  const pays = sale.payments.map((p) => `<div>${p.method}: Rs ${p.amount}</div>`).join("");
  win.document.write(`<!doctype html><html><head><title>${sale.receipt_number}</title>
    <style>
      body{font:14px/1.4 ui-monospace,monospace;padding:16px;color:#111}
      h1{font-size:16px;margin:0 0 8px}
      table{width:100%;border-collapse:collapse;margin:12px 0}
      td{padding:2px 0}
      .muted{color:#666;font-size:12px}
      @media print{body{padding:0}}
    </style></head><body>
    <h1>${business}</h1>
    <div class="muted">${sale.receipt_number} · ${sale.status}</div>
    <table>${lines}</table>
    <div>Subtotal Rs ${sale.subtotal}</div>
    <div>Discount Rs ${sale.discount_total}</div>
    <div><strong>Total Rs ${sale.total}</strong></div>
    ${pays}
    <script>window.onload=()=>{window.print();}</script>
    </body></html>`);
  win.document.close();
}

export default function SalesPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function load(tokenValue: string) {
    const next = await apiFetch<Sale[]>("/v1/sales", { token: tokenValue });
    setSales(next);
  }

  useEffect(() => {
    const storedToken = getToken();
    const stored = getStoredUser();
    if (!storedToken || !stored) {
      router.replace("/login");
      return;
    }
    if (!canUsePos(stored.role)) {
      router.replace("/dashboard");
      return;
    }
    setUser(stored);
    setToken(storedToken);
    load(storedToken).catch((err) =>
      setError(err instanceof ApiError ? err.message : "Could not load sales"),
    );
  }, [router]);

  async function voidSale(saleId: string) {
    if (!token) return;
    setError("");
    setPendingId(saleId);
    try {
      await apiFetch<Sale>(`/v1/sales/${saleId}/void`, { method: "POST", token });
      await load(token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Void failed");
    } finally {
      setPendingId(null);
    }
  }

  async function returnSale(saleId: string) {
    if (!token) return;
    setError("");
    setPendingId(saleId);
    try {
      await apiFetch<Sale>(`/v1/sales/${saleId}/return`, {
        method: "POST",
        token,
        body: JSON.stringify({ restock: true }),
      });
      await load(token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Return failed");
    } finally {
      setPendingId(null);
    }
  }

  const returnedOf = new Set(
    sales.filter((sale) => sale.refund_of_sale_id).map((sale) => sale.refund_of_sale_id as string),
  );

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
        <h1>Sales</h1>
        <p className="lede">
          Recent receipts for this business.{" "}
          <Link href="/dashboard/pos">Back to POS</Link>
        </p>

        {error ? <p className="form-error">{error}</p> : null}

        <div className="panel">
          <p className="panel-label">History</p>
          {sales.length ? (
            <ul className="row-list">
              {sales.map((sale) => (
                <li key={sale.id} className="sale-row">
                  <div>
                    <strong>{sale.receipt_number}</strong>
                    <span className="muted">
                      {" "}
                      · {sale.status} · Rs {sale.total}
                    </span>
                    {sale.refund_of_sale_id ? (
                      <span className="muted"> · refund</span>
                    ) : null}
                    <div className="muted">
                      {sale.payments.map((p) => `${p.method} ${p.amount}`).join(" · ")}
                    </div>
                  </div>
                  <div className="sale-actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => printReceipt(sale, user.tenant.name)}
                    >
                      Print
                    </button>
                    {sale.status === "completed" &&
                    !sale.refund_of_sale_id &&
                    !returnedOf.has(sale.id) ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          disabled={pendingId === sale.id}
                          onClick={() => returnSale(sale.id)}
                        >
                          Return
                        </button>
                        {canVoid(user.role) ? (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            disabled={pendingId === sale.id}
                            onClick={() => voidSale(sale.id)}
                          >
                            Void
                          </button>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No sales yet</p>
          )}
        </div>
      </main>
    </div>
  );
}
