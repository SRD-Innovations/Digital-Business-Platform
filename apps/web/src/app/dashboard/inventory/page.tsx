"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  ApiError,
  apiFetch,
  type InventoryMovement,
  type Product,
  type User,
} from "@/lib/api";
import { getStoredUser, getToken } from "@/lib/auth";

function canEdit(role: string): boolean {
  return role === "owner" || role === "manager" || role === "stock_keeper";
}

function canView(role: string): boolean {
  return canEdit(role) || role === "accountant";
}

export default function InventoryPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [productId, setProductId] = useState("");
  const [delta, setDelta] = useState("1");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function load(tokenValue: string) {
    const [nextProducts, nextMovements] = await Promise.all([
      apiFetch<Product[]>("/v1/products?active_only=false", { token: tokenValue }),
      apiFetch<InventoryMovement[]>("/v1/inventory/movements?limit=40", { token: tokenValue }),
    ]);
    setProducts(nextProducts);
    setMovements(nextMovements);
    if (!productId && nextProducts[0]) setProductId(nextProducts[0].id);
  }

  useEffect(() => {
    const storedToken = getToken();
    const stored = getStoredUser();
    if (!storedToken || !stored) {
      router.replace("/login");
      return;
    }
    if (!canView(stored.role)) {
      router.replace("/dashboard");
      return;
    }
    setUser(stored);
    setToken(storedToken);
    load(storedToken).catch((err) =>
      setError(err instanceof ApiError ? err.message : "Could not load inventory"),
    );
  }, [router]);

  async function onAdjust(event: FormEvent) {
    event.preventDefault();
    if (!token || !user || !canEdit(user.role) || !productId) return;
    setError("");
    setPending(true);
    try {
      await apiFetch<InventoryMovement>("/v1/inventory/adjustments", {
        method: "POST",
        token,
        body: JSON.stringify({
          product_id: productId,
          quantity_delta: delta,
          note: note || null,
        }),
      });
      setNote("");
      await load(token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Adjustment failed");
    } finally {
      setPending(false);
    }
  }

  if (!user) {
    return <p className="lede">Loading…</p>;
  }

  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? id;

  return (
    <main className="shell shell-wide">
        <p className="eyebrow">{user.tenant.name}</p>
        <h1>Inventory</h1>
        <p className="lede">
          On-hand stock and movement history. <Link href="/dashboard/purchases">Receive purchases</Link>
          {" · "}
          <Link href="/dashboard/products">Products</Link>
        </p>

        <div className="panel">
          <p className="panel-label">On hand</p>
          {products.length ? (
            <ul className="row-list">
              {products.map((product) => (
                <li key={product.id}>
                  <span>{product.name}</span>
                  <span className="muted">{product.stock_on_hand}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No products</p>
          )}
        </div>

        {canEdit(user.role) ? (
          <form className="panel form" style={{ marginTop: "1.25rem" }} onSubmit={onAdjust}>
            <p className="panel-label">Adjust stock</p>
            <label>
              Product
              <select value={productId} onChange={(e) => setProductId(e.target.value)}>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Quantity change (+/−)
              <input value={delta} onChange={(e) => setDelta(e.target.value)} required />
            </label>
            <label>
              Note
              <input value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            <button className="btn" type="submit" disabled={pending || !products.length}>
              {pending ? "Saving…" : "Post adjustment"}
            </button>
          </form>
        ) : error ? (
          <p className="form-error">{error}</p>
        ) : null}

        <div className="panel" style={{ marginTop: "1.25rem" }}>
          <p className="panel-label">Recent movements</p>
          {movements.length ? (
            <ul className="row-list">
              {movements.map((row) => (
                <li key={row.id}>
                  <span>
                    {productName(row.product_id)}
                    <span className="muted">
                      {" "}
                      · {row.reason} · {Number(row.quantity) > 0 ? "+" : ""}
                      {row.quantity}
                    </span>
                  </span>
                  <span className="muted">{new Date(row.created_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No movements yet</p>
          )}
        </div>
      </main>
  );
}
