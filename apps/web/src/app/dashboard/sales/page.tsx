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
        <p className="eyebrow">{user.tenant.name}</p>
        <h1>Sales</h1>
        <p className="lede">
          Recent receipts for this business.
          {canAccessPos(user.role) ? (
            <>
              {" "}
              <Link href="/dashboard/pos">Back to POS</Link>
            </>
          ) : null}
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
            <p className="muted">
              No sales yet.
              {canAccessPos(user.role) ? (
                <>
                  {" "}
                  <Link href="/dashboard/pos">Open POS</Link> to make the first sale.
                </>
              ) : null}
            </p>
          )}
        </div>
      </main>
  );
}
