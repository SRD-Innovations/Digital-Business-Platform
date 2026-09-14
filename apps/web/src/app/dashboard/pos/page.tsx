"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  ApiError,
  apiFetch,
  type ParkedBill,
  type Product,
  type Sale,
  type Shift,
  type User,
} from "@/lib/api";
import { getStoredUser, getToken } from "@/lib/auth";

type CartLine = { product: Product; quantity: number };
type PayRow = { method: "cash" | "card" | "credit"; amount: string };

function canUsePos(role: string): boolean {
  return role === "owner" || role === "manager" || role === "cashier";
}

function money(value: number): string {
  return value.toFixed(2);
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

export default function PosPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [query, setQuery] = useState("");
  const [payments, setPayments] = useState<PayRow[]>([{ method: "cash", amount: "" }]);
  const [discount, setDiscount] = useState("0");
  const [shift, setShift] = useState<Shift | null>(null);
  const [parked, setParked] = useState<ParkedBill[]>([]);
  const [parkLabel, setParkLabel] = useState("Held");
  const [openingCash, setOpeningCash] = useState("0");
  const [closingCash, setClosingCash] = useState("0");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [activeParkedId, setActiveParkedId] = useState<string | null>(null);

  async function refresh(tokenValue: string) {
    const [nextProducts, nextShift, nextParked] = await Promise.all([
      apiFetch<Product[]>("/v1/products", { token: tokenValue }),
      apiFetch<Shift | null>("/v1/pos/shifts/current", { token: tokenValue }),
      apiFetch<ParkedBill[]>("/v1/pos/parked", { token: tokenValue }),
    ]);
    setProducts(nextProducts);
    setShift(nextShift);
    setParked(nextParked);
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
    refresh(storedToken).catch((err) =>
      setError(err instanceof ApiError ? err.message : "Could not load POS"),
    );
  }, [router]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(q) ||
        (product.sku ?? "").toLowerCase().includes(q) ||
        (product.barcode ?? "").toLowerCase().includes(q),
    );
  }, [products, query]);

  const subtotal = cart.reduce(
    (sum, line) => sum + Number(line.product.unit_price) * line.quantity,
    0,
  );
  const discountValue = Math.max(0, Number(discount) || 0);
  const total = Math.max(0, subtotal - discountValue);
  const paid = payments.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);

  useEffect(() => {
    if (payments.length === 1) {
      setPayments([{ method: payments[0].method, amount: money(total) }]);
    }
  }, [total]); // eslint-disable-line react-hooks/exhaustive-deps

  function addProduct(product: Product) {
    setLastSale(null);
    setError("");
    setCart((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      if (existing) {
        return current.map((line) =>
          line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      return [...current, { product, quantity: 1 }];
    });
  }

  function setQuantity(productId: string, quantity: number) {
    setCart((current) =>
      current
        .map((line) => (line.product.id === productId ? { ...line, quantity } : line))
        .filter((line) => line.quantity > 0),
    );
  }

  async function openShift() {
    if (!token) return;
    setError("");
    setPending(true);
    try {
      const next = await apiFetch<Shift>("/v1/pos/shifts/open", {
        method: "POST",
        token,
        body: JSON.stringify({ opening_cash: openingCash || "0" }),
      });
      setShift(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not open shift");
    } finally {
      setPending(false);
    }
  }

  async function closeShift() {
    if (!token || !shift) return;
    setError("");
    setPending(true);
    try {
      await apiFetch<Shift>(`/v1/pos/shifts/${shift.id}/close`, {
        method: "POST",
        token,
        body: JSON.stringify({ closing_cash: closingCash || "0" }),
      });
      setShift(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not close shift");
    } finally {
      setPending(false);
    }
  }

  async function parkBill() {
    if (!token || !cart.length) return;
    setError("");
    setPending(true);
    try {
      if (activeParkedId) {
        await apiFetch<void>(`/v1/pos/parked/${activeParkedId}`, {
          method: "DELETE",
          token,
        });
      }
      await apiFetch<ParkedBill>("/v1/pos/park", {
        method: "POST",
        token,
        body: JSON.stringify({
          label: parkLabel || "Held",
          discount_total: money(discountValue),
          lines: cart.map((line) => ({
            product_id: line.product.id,
            quantity: String(line.quantity),
          })),
        }),
      });
      setCart([]);
      setDiscount("0");
      setActiveParkedId(null);
      await refresh(token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not park bill");
    } finally {
      setPending(false);
    }
  }

  function resumeParked(bill: ParkedBill) {
    const lines = (bill.cart_json.lines as { product_id: string; quantity: string }[]) || [];
    const nextCart: CartLine[] = [];
    for (const line of lines) {
      const product = products.find((item) => item.id === line.product_id);
      if (product) nextCart.push({ product, quantity: Number(line.quantity) });
    }
    setCart(nextCart);
    setDiscount(String(bill.cart_json.discount_total ?? "0"));
    setActiveParkedId(bill.id);
    setParkLabel(bill.label);
    setError("");
  }

  async function checkout() {
    if (!token || !cart.length) return;
    setError("");
    setPending(true);
    try {
      const payRows = payments
        .map((row) => ({ method: row.method, amount: money(Number(row.amount) || 0) }))
        .filter((row) => Number(row.amount) > 0);
      const sale = await apiFetch<Sale>("/v1/pos/checkout", {
        method: "POST",
        token,
        body: JSON.stringify({
          discount_total: money(discountValue),
          parked_bill_id: activeParkedId,
          lines: cart.map((line) => ({
            product_id: line.product.id,
            quantity: String(line.quantity),
          })),
          payments: payRows,
        }),
      });
      setLastSale(sale);
      setCart([]);
      setDiscount("0");
      setPayments([{ method: "cash", amount: "" }]);
      setActiveParkedId(null);
      await refresh(token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Checkout failed");
    } finally {
      setPending(false);
    }
  }

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
        <h1>POS</h1>
        <p className="lede">
          Open a shift, sell, split payments, park bills, then print the receipt.{" "}
          <Link href="/dashboard/products">Products</Link>
          {" · "}
          <Link href="/dashboard/sales">Sales</Link>
        </p>

        <div className="panel form" style={{ marginBottom: "1.25rem" }}>
          <p className="panel-label">Shift</p>
          {shift ? (
            <>
              <p className="muted">
                Open · cash in drawer expected later from opening Rs {shift.opening_cash} + cash
                sales Rs {shift.cash_sales_total}
              </p>
              <label>
                Closing cash count
                <input value={closingCash} onChange={(e) => setClosingCash(e.target.value)} />
              </label>
              <button className="btn btn-secondary" type="button" disabled={pending} onClick={closeShift}>
                Close shift
              </button>
            </>
          ) : (
            <>
              <label>
                Opening cash
                <input value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} />
              </label>
              <button className="btn" type="button" disabled={pending} onClick={openShift}>
                Open shift
              </button>
            </>
          )}
        </div>

        <div className="pos-grid">
          <div className="stack">
            <label className="panel form">
              Search name, SKU, or barcode
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Type to filter…"
              />
            </label>
            <div className="panel">
              <p className="panel-label">Products</p>
              {filtered.length ? (
                <ul className="product-grid">
                  {filtered.map((product) => (
                    <li key={product.id}>
                      <button
                        type="button"
                        className="product-tile"
                        onClick={() => addProduct(product)}
                        disabled={!shift}
                      >
                        <span>{product.name}</span>
                        <span className="muted">Rs {product.unit_price}</span>
                        <span className="muted">Stock {product.stock_on_hand}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No matching products.</p>
              )}
            </div>
            <div className="panel">
              <p className="panel-label">Parked bills</p>
              {parked.length ? (
                <ul className="row-list">
                  {parked.map((bill) => (
                    <li key={bill.id}>
                      <button type="button" className="btn btn-secondary" onClick={() => resumeParked(bill)}>
                        Resume {bill.label}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">None held</p>
              )}
            </div>
          </div>

          <div className="stack">
            <div className="panel">
              <p className="panel-label">Cart</p>
              {cart.length ? (
                <ul className="row-list">
                  {cart.map((line) => (
                    <li key={line.product.id}>
                      <span>
                        {line.product.name}
                        <span className="muted"> · Rs {line.product.unit_price}</span>
                      </span>
                      <input
                        className="qty-input"
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(event) =>
                          setQuantity(line.product.id, Number(event.target.value) || 0)
                        }
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">Cart is empty</p>
              )}
            </div>

            <div className="panel form">
              <p className="panel-label">Pay</p>
              <p>
                Subtotal <strong>Rs {money(subtotal)}</strong>
              </p>
              <label>
                Discount
                <input value={discount} onChange={(event) => setDiscount(event.target.value)} />
              </label>
              {payments.map((row, index) => (
                <div key={index} className="pay-row">
                  <select
                    value={row.method}
                    onChange={(event) => {
                      const next = [...payments];
                      next[index] = {
                        ...row,
                        method: event.target.value as PayRow["method"],
                      };
                      setPayments(next);
                    }}
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="credit">Credit</option>
                  </select>
                  <input
                    value={row.amount}
                    onChange={(event) => {
                      const next = [...payments];
                      next[index] = { ...row, amount: event.target.value };
                      setPayments(next);
                    }}
                    placeholder="Amount"
                  />
                </div>
              ))}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setPayments((rows) => [...rows, { method: "card", amount: "" }])}
              >
                Add payment split
              </button>
              <p>
                Total <strong>Rs {money(total)}</strong>
                <span className="muted"> · paid Rs {money(paid)}</span>
              </p>
              <label>
                Hold label
                <input value={parkLabel} onChange={(e) => setParkLabel(e.target.value)} />
              </label>
              {error ? <p className="form-error">{error}</p> : null}
              <div className="home-actions">
                <button
                  className="btn"
                  type="button"
                  disabled={pending || !cart.length || !shift}
                  onClick={checkout}
                >
                  {pending ? "Charging…" : "Complete sale"}
                </button>
                <button
                  className="btn btn-secondary"
                  type="button"
                  disabled={pending || !cart.length || !shift}
                  onClick={parkBill}
                >
                  Park bill
                </button>
              </div>
            </div>

            {lastSale ? (
              <div className="panel">
                <p className="panel-label">Last receipt</p>
                <p>
                  {lastSale.receipt_number} · Rs {lastSale.total}
                </p>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => printReceipt(lastSale, user.tenant.name)}
                >
                  Print receipt
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
