"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  ApiError,
  apiFetch,
  type PriceTier,
  type Product,
  type ProductBatch,
  type User,
} from "@/lib/api";
import { getStoredUser, getToken } from "@/lib/auth";
import { canAccessPos } from "@/lib/roles";
import { expiryBadgeClass, expiryLabel, expiryTone } from "@/lib/stock";

function canEditCatalog(role: string): boolean {
  return role === "owner" || role === "manager" || role === "stock_keeper";
}

export default function ProductsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tiers, setTiers] = useState<PriceTier[]>([]);
  const [batches, setBatches] = useState<ProductBatch[]>([]);
  const [minQty, setMinQty] = useState("10");
  const [tierPrice, setTierPrice] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function loadProducts(tokenValue: string) {
    const next = await apiFetch<Product[]>("/v1/products?active_only=false", { token: tokenValue });
    setProducts(next);
    return next;
  }

  async function loadTrade(tokenValue: string, productId: string) {
    const [nextTiers, nextBatches] = await Promise.all([
      apiFetch<PriceTier[]>(`/v1/products/${productId}/price-tiers`, { token: tokenValue }),
      apiFetch<ProductBatch[]>(`/v1/products/${productId}/batches`, { token: tokenValue }),
    ]);
    setTiers(nextTiers);
    setBatches(nextBatches);
  }

  useEffect(() => {
    const storedToken = getToken();
    const stored = getStoredUser();
    if (!storedToken || !stored) {
      router.replace("/login");
      return;
    }
    if (!canEditCatalog(stored.role) && stored.role !== "cashier") {
      router.replace("/dashboard");
      return;
    }
    setUser(stored);
    setToken(storedToken);
    loadProducts(storedToken).catch((err) =>
      setError(err instanceof ApiError ? err.message : "Could not load products"),
    );
  }, [router]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !user || !canEditCatalog(user.role)) return;
    setError("");
    setPending(true);
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const created = await apiFetch<Product>("/v1/products", {
        method: "POST",
        token,
        body: JSON.stringify({
          name: data.get("name"),
          sku: data.get("sku") || null,
          barcode: data.get("barcode") || null,
          unit_price: data.get("unit_price"),
          stock_on_hand: data.get("stock_on_hand") || "0",
          track_batches: data.get("track_batches") === "on",
        }),
      });
      setProducts((current) => [created, ...current].sort((a, b) => a.name.localeCompare(b.name)));
      form.reset();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create product");
    } finally {
      setPending(false);
    }
  }

  async function selectProduct(product: Product) {
    if (!token) return;
    setSelectedId(product.id);
    setError("");
    try {
      await loadTrade(token, product.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load trade details");
    }
  }

  async function saveTier(event: FormEvent) {
    event.preventDefault();
    if (!token || !selectedId || !canEditCatalog(user?.role ?? "")) return;
    setPending(true);
    setError("");
    try {
      const next = [
        ...tiers.map((tier) => ({ min_qty: tier.min_qty, unit_price: tier.unit_price })),
        { min_qty: minQty, unit_price: tierPrice },
      ];
      const saved = await apiFetch<PriceTier[]>(`/v1/products/${selectedId}/price-tiers`, {
        method: "PUT",
        token,
        body: JSON.stringify({ tiers: next }),
      });
      setTiers(saved);
      setTierPrice("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save tier");
    } finally {
      setPending(false);
    }
  }

  async function toggleBatches(product: Product) {
    if (!token || !canEditCatalog(user?.role ?? "")) return;
    try {
      await apiFetch(`/v1/products/${product.id}/track-batches`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ track_batches: !product.track_batches }),
      });
      const next = await loadProducts(token);
      const updated = next.find((row) => row.id === product.id);
      if (updated) await selectProduct(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update batch tracking");
    }
  }

  if (!user) {
    return <p className="lede">Loading…</p>;
  }

  const selected = products.find((product) => product.id === selectedId) ?? null;

  return (
    <main className="shell shell-wide">
        <p className="eyebrow">{user.tenant.name}</p>
        <h1>Products</h1>
        <p className="lede">
          Catalog with wholesale tiers and optional batch/expiry tracking.
          {canAccessPos(user.role) ? (
            <>
              {" "}
              <Link href="/dashboard/pos">Open POS</Link>
              {" · "}
            </>
          ) : (
            " "
          )}
          <Link href="/dashboard/purchases">Purchases</Link>
        </p>
        <div className="stack">
          <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {products.length ? (
                    products.map((product) => {
                      const selected = selectedId === product.id;
                      return (
                        <tr key={product.id} data-tone={selected ? "selected" : undefined}>
                          <td>
                            {product.name}
                            {product.track_batches ? (
                              <span className="badge badge-trade" style={{ marginLeft: 8 }}>
                                Batches
                              </span>
                            ) : null}
                          </td>
                          <td className="mono">{product.sku ?? "—"}</td>
                          <td className="num">Rs {product.unit_price}</td>
                          <td className="num">{product.stock_on_hand}</td>
                          <td>
                            {canEditCatalog(user.role) ? (
                              <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => selectProduct(product)}
                              >
                                Tiers / expiry
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="muted">
                        No products yet. Add your first SKU below to sell in POS.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {selected && canEditCatalog(user.role) ? (
            <div className="panel form">
              <p className="panel-label">Trade settings · {selected.name}</p>
              <button type="button" className="btn btn-secondary" onClick={() => toggleBatches(selected)}>
                {selected.track_batches ? "Disable batch tracking" : "Enable batch tracking"}
              </button>
              <form onSubmit={saveTier}>
                <label>
                  Wholesale min qty
                  <input value={minQty} onChange={(e) => setMinQty(e.target.value)} required />
                </label>
                <label>
                  Tier price
                  <input value={tierPrice} onChange={(e) => setTierPrice(e.target.value)} required />
                </label>
                <button className="btn" type="submit" disabled={pending}>
                  Add price tier
                </button>
              </form>
              {tiers.length ? (
                <ul className="row-list">
                  {tiers.map((tier) => (
                    <li key={tier.id}>
                      <span>
                        From qty {tier.min_qty}
                        <span className="muted"> · Rs {tier.unit_price}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No wholesale tiers</p>
              )}
              {selected.track_batches ? (
                <>
                  <p className="panel-label">Batches</p>
                  {batches.length ? (
                    <ul className="row-list">
                      {batches.map((batch) => {
                        const tone = expiryTone(batch.expiry_date);
                        return (
                          <li key={batch.id}>
                            <span>
                              <span className="mono">{batch.batch_code}</span>
                              <span className="muted"> · qty {batch.quantity}</span>
                            </span>
                            {batch.expiry_date ? (
                              <span className={expiryBadgeClass(tone)}>
                                {expiryLabel(batch.expiry_date, tone)}
                              </span>
                            ) : (
                              <span className="badge badge-neutral">No expiry</span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="muted">No batches — receive with a batch code</p>
                  )}
                </>
              ) : null}
            </div>
          ) : null}

          {canEditCatalog(user.role) ? (
            <form className="panel form" onSubmit={onSubmit}>
              <p className="panel-label">Add product</p>
              <label>
                Name
                <input name="name" required minLength={1} placeholder="Samba Rice 5kg" />
              </label>
              <label>
                Price (LKR)
                <input name="unit_price" required inputMode="decimal" placeholder="1850.00" />
              </label>
              <label>
                Opening stock
                <input name="stock_on_hand" inputMode="decimal" placeholder="10" defaultValue="0" />
              </label>
              <label>
                SKU (optional)
                <input name="sku" placeholder="RICE-5" />
              </label>
              <label>
                Barcode (optional)
                <input name="barcode" placeholder="4790001234567" />
              </label>
              <label className="checkbox-row">
                <input name="track_batches" type="checkbox" />
                Track batch / expiry (pharmacy-style)
              </label>
              {error ? <p className="form-error">{error}</p> : null}
              <button className="btn" type="submit" disabled={pending}>
                {pending ? "Saving…" : "Add product"}
              </button>
            </form>
          ) : null}
          {error && !canEditCatalog(user.role) ? <p className="form-error">{error}</p> : null}
        </div>
      </main>
  );
}
