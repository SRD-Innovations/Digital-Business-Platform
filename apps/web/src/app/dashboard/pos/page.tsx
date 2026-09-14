"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
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
import { printReceipt, receiptBusinessFromUser } from "@/lib/printReceipt";
import { readCachedProducts } from "@/lib/offline/db";
import {
  checkoutOnlineOrQueue,
  flushPendingCheckouts,
  loadProductsForPos,
  readSyncStatus,
  type SyncStatus,
} from "@/lib/offline/sync";

type CartLine = { product: Product; quantity: number };
type PayRow = { method: "cash" | "card" | "credit"; amount: string };

function canUsePos(role: string): boolean {
  return role === "owner" || role === "manager" || role === "cashier";
}

function money(value: number): string {
  return value.toFixed(2);
}

function formatSynced(iso: string | null): string {
  if (!iso) return "never";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
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
  const [fromCache, setFromCache] = useState(false);
  const [sync, setSync] = useState<SyncStatus>({
    online: true,
    pendingCount: 0,
    lastSyncedAt: null,
    flushing: false,
    lastError: null,
  });

  async function refreshSync(tenantId: string) {
    setSync(await readSyncStatus(tenantId));
  }

  async function refresh(tokenValue: string, tenantId: string) {
    const catalog = await loadProductsForPos(tokenValue, tenantId);
    setProducts(catalog.products);
    setFromCache(catalog.fromCache);
    try {
      const [nextShift, nextParked] = await Promise.all([
        apiFetch<Shift | null>("/v1/pos/shifts/current", { token: tokenValue }),
        apiFetch<ParkedBill[]>("/v1/pos/parked", { token: tokenValue }),
      ]);
      setShift(nextShift);
      setParked(nextParked);
    } catch {
      // Catalog may still load from cache while shift/park need network.
    }
    await refreshSync(tenantId);
  }

  async function tryFlush(tokenValue: string, tenantId: string) {
    const result = await flushPendingCheckouts(tokenValue, tenantId);
    await refreshSync(tenantId);
    if (result.error) {
      setError(`Sync paused: ${result.error}`);
    } else if (result.synced > 0) {
      setError("");
      await refresh(tokenValue, tenantId);
    }
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
    refresh(storedToken, stored.tenant.id).catch((err) =>
      setError(err instanceof ApiError ? err.message : "Could not load POS"),
    );

    const onOnline = () => {
      tryFlush(storedToken, stored.tenant.id).catch(() => undefined);
      refreshSync(stored.tenant.id).catch(() => undefined);
    };
    const onOffline = () => {
      refreshSync(stored.tenant.id).catch(() => undefined);
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
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

  function tryScanAdd(raw: string): boolean {
    const code = raw.trim().toLowerCase();
    if (!code) return false;
    const byBarcode = products.find((p) => (p.barcode ?? "").toLowerCase() === code);
    const bySku = products.find((p) => (p.sku ?? "").toLowerCase() === code);
    const match = byBarcode ?? bySku;
    if (!match) {
      setError(`No product for barcode/SKU “${raw.trim()}”`);
      return false;
    }
    if (!shift && sync.online) {
      setError("Open a shift before scanning items");
      return false;
    }
    addProduct(match);
    setQuery("");
    return true;
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    tryScanAdd(query);
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
    if (sync.pendingCount > 0) {
      setError("Sync pending sales before closing the shift");
      return;
    }
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
    if (!token || !user || !cart.length) return;
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
      await refresh(token, user.tenant.id);
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
    if (!token || !user || !cart.length) return;
    setError("");
    setPending(true);
    try {
      const payRows = payments
        .map((row) => ({ method: row.method, amount: money(Number(row.amount) || 0) }))
        .filter((row) => Number(row.amount) > 0);
      const result = await checkoutOnlineOrQueue({
        token,
        tenantId: user.tenant.id,
        discountTotal: money(discountValue),
        parkedBillId: activeParkedId,
        lines: cart.map((line) => ({
          product_id: line.product.id,
          quantity: String(line.quantity),
        })),
        payments: payRows,
      });
      if (result.sale) {
        setLastSale(result.sale);
        setError("");
      } else if (result.queued) {
        setLastSale(null);
        setError("Sale saved on this device — will sync when online");
      }
      setCart([]);
      setDiscount("0");
      setPayments([{ method: "cash", amount: "" }]);
      setActiveParkedId(null);
      if (result.queued) {
        const cached = await readCachedProducts(user.tenant.id);
        setProducts(
          cached.map(({ tenant_id: _t, ...product }) => ({
            ...product,
            track_batches: product.track_batches ?? false,
          })),
        );
        setFromCache(true);
        await refreshSync(user.tenant.id);
      } else {
        await refresh(token, user.tenant.id);
      }
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

        <div className="panel sync-status" style={{ marginBottom: "1.25rem" }}>
          <p className="panel-label">Sync</p>
          <p className="muted">
            {sync.online ? "Online" : "Offline"}
            {" · "}
            pending {sync.pendingCount}
            {" · "}
            last synced {formatSynced(sync.lastSyncedAt)}
            {fromCache ? " · catalog from this device" : ""}
          </p>
          {sync.lastError ? <p className="form-error">{sync.lastError}</p> : null}
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!token || !sync.online || sync.pendingCount === 0}
            onClick={() => token && tryFlush(token, user.tenant.id)}
          >
            Sync now
          </button>
        </div>

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
              <button className="btn" type="button" disabled={pending || !sync.online} onClick={openShift}>
                Open shift
              </button>
              {!sync.online ? (
                <p className="muted">Open a shift while online before selling offline.</p>
              ) : null}
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
                onKeyDown={onSearchKeyDown}
                placeholder="Type to filter, or scan + Enter"
                autoComplete="off"
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
                        disabled={!shift && sync.online}
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
                  disabled={pending || !cart.length || (!shift && sync.online)}
                  onClick={checkout}
                >
                  {pending ? "Charging…" : "Complete sale"}
                </button>
                <button
                  className="btn btn-secondary"
                  type="button"
                  disabled={pending || !cart.length || !shift || !sync.online}
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
                  onClick={() =>
                    printReceipt(lastSale, receiptBusinessFromUser(user), {
                      cashierName: user.full_name,
                    })
                  }
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
