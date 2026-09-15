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
import { canAccessPos } from "@/lib/roles";
import { printReceipt, receiptBusinessFromUser } from "@/lib/printReceipt";
import { readCachedProducts } from "@/lib/offline/db";
import {
  checkoutOnlineOrQueue,
  flushPendingCheckouts,
  loadProductsForPos,
  readSyncStatus,
  type SyncStatus,
} from "@/lib/offline/sync";
import { SyncIndicator, syncUiState } from "@/components/SyncIndicator";
import { IconMinus, IconPlus } from "@/components/Icons";
import { stockBadgeClass, stockLabel, stockTone } from "@/lib/stock";

type CartLine = { product: Product; quantity: number };
type PayRow = { method: "cash" | "card" | "credit"; amount: string };
type CatalogFilter = "all" | "in-stock" | "low-stock" | "out-of-stock";
type CartMode = "sale" | "return";

function money(value: number): string {
  return value.toFixed(2);
}

export default function PosPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CatalogFilter>("all");
  const [mode, setMode] = useState<CartMode>("sale");
  const [payments, setPayments] = useState<PayRow[]>([{ method: "cash", amount: "" }]);
  const [discount, setDiscount] = useState("0");
  const [shift, setShift] = useState<Shift | null>(null);
  const [parked, setParked] = useState<ParkedBill[]>([]);
  const [parkLabel, setParkLabel] = useState("Held");
  const [openingCash, setOpeningCash] = useState("0");
  const [closingCash, setClosingCash] = useState("0");
  const [shiftModal, setShiftModal] = useState<"open" | "close" | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [queuedNotice, setQueuedNotice] = useState(false);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [returnSale, setReturnSale] = useState<Sale | null>(null);
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
    if (!canAccessPos(stored.role)) {
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
    return products.filter((product) => {
      const tone = stockTone(product.stock_on_hand);
      if (filter !== "all" && tone !== filter) return false;
      if (!q) return true;
      return (
        product.name.toLowerCase().includes(q) ||
        (product.sku ?? "").toLowerCase().includes(q) ||
        (product.barcode ?? "").toLowerCase().includes(q)
      );
    });
  }, [products, query, filter]);

  const subtotal = cart.reduce(
    (sum, line) => sum + Number(line.product.unit_price) * line.quantity,
    0,
  );
  const discountValue = Math.max(0, Number(discount) || 0);
  const total = Math.max(0, subtotal - discountValue);
  const paid = payments.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const syncState = syncUiState(sync);

  useEffect(() => {
    if (payments.length === 1) {
      setPayments([{ method: payments[0].method, amount: money(total) }]);
    }
  }, [total]); // eslint-disable-line react-hooks/exhaustive-deps

  function addProduct(product: Product) {
    if (mode === "return") return;
    setLastSale(null);
    setQueuedNotice(false);
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
      setShiftModal(null);
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
      setShiftModal(null);
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
    setMode("sale");
    setReturnSale(null);
    setCart(nextCart);
    setDiscount(String(bill.cart_json.discount_total ?? "0"));
    setActiveParkedId(bill.id);
    setParkLabel(bill.label);
    setError("");
  }

  async function loadReturns() {
    if (!token) return;
    try {
      const sales = await apiFetch<Sale[]>("/v1/sales", { token });
      setRecentSales(sales.filter((sale) => sale.status === "completed" && !sale.refund_of_sale_id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load sales for return");
    }
  }

  function enterReturnMode() {
    setMode("return");
    setCart([]);
    setLastSale(null);
    setQueuedNotice(false);
    setReturnSale(null);
    loadReturns().catch(() => undefined);
  }

  function pickReturn(sale: Sale) {
    setReturnSale(sale);
    setCart(
      sale.lines
        .map((line) => {
          const product = products.find((item) => item.id === line.product_id);
          if (!product) return null;
          return { product, quantity: Number(line.quantity) };
        })
        .filter((line): line is CartLine => Boolean(line)),
    );
  }

  async function processReturn() {
    if (!token || !returnSale) return;
    setPending(true);
    setError("");
    try {
      const next = await apiFetch<Sale>(`/v1/sales/${returnSale.id}/return`, {
        method: "POST",
        token,
        body: JSON.stringify({ restock: true }),
      });
      setLastSale(next);
      setCart([]);
      setReturnSale(null);
      setMode("sale");
      await refresh(token, user!.tenant.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Return failed");
    } finally {
      setPending(false);
    }
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
        setQueuedNotice(false);
        setError("");
      } else if (result.queued) {
        setLastSale(null);
        setQueuedNotice(true);
        setError("");
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
    return <p className="lede">Loading…</p>;
  }

  const canSell = Boolean(shift) || !sync.online;

  return (
    <div className="pos-workspace">
      <div className="pos-toolbar">
        <SyncIndicator sync={sync} fromCache={fromCache} />
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setShiftModal(shift ? "close" : "open")}
        >
          {shift ? `Shift open · Rs ${shift.opening_cash}` : "Open shift"}
        </button>
        {sync.pendingCount > 0 && sync.online ? (
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!token || sync.flushing}
            onClick={() => token && tryFlush(token, user.tenant.id)}
          >
            Sync now
          </button>
        ) : null}
        <label className="pos-search">
          <span className="visually-hidden">Search</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onSearchKeyDown}
            placeholder="Search or scan barcode, then Enter"
            autoComplete="off"
            aria-label="Search name, SKU, or barcode"
          />
        </label>
      </div>

      {syncState === "conflict" ? (
        <div className="banner banner-danger" style={{ margin: "8px 12px 0" }}>
          <span>
            Last-write-loses conflict. The server copy was kept. Review the queued sale, then sync
            again. {sync.lastError}
          </span>
        </div>
      ) : null}

      <div className="pos-body">
        <section className="pos-catalog" aria-label="Catalog">
          <div className="chip-row">
            {(
              [
                ["all", "All"],
                ["in-stock", "In stock"],
                ["low-stock", "Low"],
                ["out-of-stock", "Out"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className="chip"
                data-active={filter === id ? "true" : "false"}
                onClick={() => setFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="pos-catalog-scroll">
            {filtered.length ? (
              <ul className="product-grid">
                {filtered.map((product) => {
                  const tone = stockTone(product.stock_on_hand);
                  return (
                    <li key={product.id}>
                      <button
                        type="button"
                        className="product-tile"
                        data-stock={tone}
                        onClick={() => addProduct(product)}
                        disabled={!canSell || tone === "out-of-stock" || mode === "return"}
                      >
                        <strong>{product.name}</strong>
                        <span className="muted">Rs {product.unit_price}</span>
                        <span className={stockBadgeClass(tone)}>
                          {stockLabel(tone)} · {product.stock_on_hand}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="muted">
                No matching products. <Link href="/dashboard/products">Add products</Link>
              </p>
            )}
          </div>
        </section>

        <aside className="pos-cart" aria-label="Cart">
          <div className="pos-cart-head">
            <div className="chip-row">
              <button
                type="button"
                className="chip"
                data-active={mode === "sale" ? "true" : "false"}
                onClick={() => {
                  setMode("sale");
                  setReturnSale(null);
                }}
              >
                Sale
              </button>
              <button
                type="button"
                className="chip"
                data-active={mode === "return" ? "true" : "false"}
                onClick={enterReturnMode}
              >
                Return
              </button>
            </div>
            {activeParkedId ? <span className="badge badge-warning">Parked</span> : null}
          </div>

          {parked.length && mode === "sale" ? (
            <div className="parked-row">
              {parked.map((bill) => (
                <button key={bill.id} type="button" className="chip" onClick={() => resumeParked(bill)}>
                  Resume {bill.label}
                </button>
              ))}
            </div>
          ) : null}

          {mode === "return" && !returnSale ? (
            <div className="pos-cart-lines">
              {recentSales.length ? (
                <ul className="row-list">
                  {recentSales.slice(0, 12).map((sale) => (
                    <li key={sale.id}>
                      <span>
                        <span className="mono">{sale.receipt_number}</span>
                        <span className="muted"> · Rs {sale.total}</span>
                      </span>
                      <button type="button" className="btn btn-secondary" onClick={() => pickReturn(sale)}>
                        Refund
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No completed sales to return.</p>
              )}
            </div>
          ) : (
            <div className="pos-cart-lines">
              {queuedNotice ? (
                <div className="banner banner-queued" style={{ margin: "8px 0" }}>
                  Sale saved on this device — will sync when online.
                </div>
              ) : null}
              {cart.length ? (
                cart.map((line) => (
                  <div
                    key={line.product.id}
                    className="cart-line"
                    data-queued={queuedNotice ? "true" : undefined}
                  >
                    <div>
                      <div className="cart-line-name">{line.product.name}</div>
                      <div className="muted">Rs {line.product.unit_price}</div>
                    </div>
                    {mode === "sale" ? (
                      <div className="qty-stepper">
                        <button
                          type="button"
                          aria-label="Decrease"
                          onClick={() => setQuantity(line.product.id, line.quantity - 1)}
                        >
                          <IconMinus />
                        </button>
                        <input
                          value={line.quantity}
                          onChange={(event) =>
                            setQuantity(line.product.id, Number(event.target.value) || 0)
                          }
                          inputMode="numeric"
                          aria-label={`Quantity for ${line.product.name}`}
                        />
                        <button
                          type="button"
                          aria-label="Increase"
                          onClick={() => setQuantity(line.product.id, line.quantity + 1)}
                        >
                          <IconPlus />
                        </button>
                      </div>
                    ) : (
                      <span className="muted">× {line.quantity}</span>
                    )}
                    <strong>Rs {money(Number(line.product.unit_price) * line.quantity)}</strong>
                  </div>
                ))
              ) : (
                <p className="muted" style={{ padding: "16px 0" }}>
                  {mode === "return"
                    ? "Pick a receipt to refund."
                    : "Cart is empty — scan or tap a product."}
                </p>
              )}
            </div>
          )}

          <div className="pos-cart-foot">
            {mode === "return" ? (
              <>
                {returnSale ? (
                  <p className="muted" style={{ margin: 0 }}>
                    Refund <span className="mono">{returnSale.receipt_number}</span> · Rs{" "}
                    {returnSale.total}
                  </p>
                ) : null}
                {error ? <p className="form-error">{error}</p> : null}
                <button
                  className="btn btn-danger btn-block"
                  type="button"
                  disabled={pending || !returnSale}
                  onClick={processReturn}
                >
                  {pending ? "Refunding…" : "Process return"}
                </button>
              </>
            ) : (
              <>
                <div className="totals-row">
                  <span>Subtotal</span>
                  <span>Rs {money(subtotal)}</span>
                </div>
                <label>
                  <span className="muted">Discount</span>
                  <input
                    className="qty-input"
                    style={{ width: "100%" }}
                    value={discount}
                    onChange={(event) => setDiscount(event.target.value)}
                  />
                </label>
                <div className="tender-row">
                  {(["cash", "card", "credit"] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      className="btn btn-secondary"
                      data-active={payments[0]?.method === method ? "true" : "false"}
                      onClick={() =>
                        setPayments((rows) =>
                          rows.length
                            ? [{ ...rows[0], method }, ...rows.slice(1)]
                            : [{ method, amount: money(total) }],
                        )
                      }
                    >
                      {method}
                    </button>
                  ))}
                </div>
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
                  className="btn btn-ghost"
                  onClick={() => setPayments((rows) => [...rows, { method: "card", amount: "" }])}
                >
                  Add split
                </button>
                <div className="totals-row">
                  <strong>Total</strong>
                  <strong>Rs {money(total)}</strong>
                </div>
                <p className="muted" style={{ margin: 0 }}>
                  Paid Rs {money(paid)}
                </p>
                {error ? <p className="form-error">{error}</p> : null}
                <button
                  className="btn btn-block"
                  type="button"
                  disabled={pending || !cart.length || !canSell}
                  onClick={checkout}
                >
                  {pending ? "Charging…" : "Charge"}
                </button>
                <div className="home-actions" style={{ marginTop: 0 }}>
                  <input
                    className="qty-input"
                    style={{ flex: 1, width: "auto" }}
                    value={parkLabel}
                    onChange={(e) => setParkLabel(e.target.value)}
                    aria-label="Hold label"
                    placeholder="Hold label"
                  />
                  <button
                    className="btn btn-secondary"
                    type="button"
                    disabled={pending || !cart.length || !shift || !sync.online}
                    onClick={parkBill}
                  >
                    Park
                  </button>
                </div>
                {lastSale ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-block"
                    onClick={() =>
                      printReceipt(lastSale, receiptBusinessFromUser(user), {
                        cashierName: user.full_name,
                      })
                    }
                  >
                    Print {lastSale.receipt_number}
                  </button>
                ) : null}
              </>
            )}
          </div>
        </aside>
      </div>

      {shiftModal ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setShiftModal(null)}>
          <div
            className="modal"
            role="dialog"
            aria-labelledby="shift-title"
            onClick={(event) => event.stopPropagation()}
          >
            {shiftModal === "open" ? (
              <>
                <h2 id="shift-title">Open shift</h2>
                <p className="lede">Count the drawer before the first sale.</p>
                <label className="form">
                  Opening cash (LKR)
                  <input
                    value={openingCash}
                    onChange={(e) => setOpeningCash(e.target.value)}
                    inputMode="decimal"
                  />
                </label>
                {error ? <p className="form-error">{error}</p> : null}
                <div className="modal-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => setShiftModal(null)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={pending || !sync.online}
                    onClick={openShift}
                  >
                    {pending ? "Opening…" : "Open shift"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 id="shift-title">Close shift</h2>
                <p className="lede">
                  Cash sales Rs {shift?.cash_sales_total ?? "0"}. Sync pending sales first.
                </p>
                <label className="form">
                  Closing cash (LKR)
                  <input
                    value={closingCash}
                    onChange={(e) => setClosingCash(e.target.value)}
                    inputMode="decimal"
                  />
                </label>
                {error ? <p className="form-error">{error}</p> : null}
                <div className="modal-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => setShiftModal(null)}>
                    Cancel
                  </button>
                  <button type="button" className="btn btn-danger" disabled={pending} onClick={closeShift}>
                    {pending ? "Closing…" : "Close shift"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
