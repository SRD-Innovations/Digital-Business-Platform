"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ApiError, apiFetch, type Sale, type User } from "@/lib/api";
import { getStoredUser, getToken } from "@/lib/auth";
import { printReceipt, receiptBusinessFromUser } from "@/lib/printReceipt";
import { canAccessPos, canAccessSales } from "@/lib/roles";

function canVoid(role: string): boolean {
  return role === "owner" || role === "manager";
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
    if (!canAccessSales(stored.role)) {
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
    return <p className="lede">Loading…</p>;
  }

  return (
    <main className="shell shell-wide">
      <div className="page-head">
        <p className="eyebrow">{user.tenant.name}</p>
        <h1>Sales</h1>
        <p className="lede">
          Recent receipts.
          {canAccessPos(user.role) ? (
            <>
              {" "}
              <Link href="/dashboard/pos">Back to POS</Link>
            </>
          ) : null}
        </p>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Receipt</th>
                <th>Status</th>
                <th>Total</th>
                <th>Tender</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sales.length ? (
                sales.map((sale) => {
                  const statusClass =
                    sale.status === "completed"
                      ? "badge badge-success"
                      : sale.status === "voided" || sale.refund_of_sale_id
                        ? "badge badge-danger"
                        : "badge badge-neutral";
                  return (
                    <tr key={sale.id}>
                      <td className="mono">{sale.receipt_number}</td>
                      <td>
                        <span className={statusClass}>
                          {sale.refund_of_sale_id ? "refund" : sale.status}
                        </span>
                      </td>
                      <td className="num">Rs {sale.total}</td>
                      <td className="muted">
                        {sale.payments.map((p) => `${p.method} ${p.amount}`).join(" · ")}
                      </td>
                      <td>
                        <div className="sale-actions">
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() =>
                              printReceipt(sale, receiptBusinessFromUser(user), {
                                cashierName: user.full_name,
                              })
                            }
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
                                  className="btn btn-danger"
                                  disabled={pendingId === sale.id}
                                  onClick={() => voidSale(sale.id)}
                                >
                                  Void
                                </button>
                              ) : null}
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="muted">
                    No sales yet.
                    {canAccessPos(user.role) ? (
                      <>
                        {" "}
                        <Link href="/dashboard/pos">Open POS</Link>
                      </>
                    ) : null}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
