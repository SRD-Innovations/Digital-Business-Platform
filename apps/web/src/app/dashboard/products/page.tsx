"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ApiError, apiFetch, type Product, type User } from "@/lib/api";
import { getStoredUser, getToken } from "@/lib/auth";

function canEditCatalog(role: string): boolean {
  return role === "owner" || role === "manager" || role === "stock_keeper";
}

export default function ProductsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

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
    apiFetch<Product[]>("/v1/products?active_only=false", { token: storedToken })
      .then(setProducts)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load products"));
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
        <h1>Products</h1>
        <p className="lede">
          Simple catalog for checkout. Full inventory and purchasing come with ERP later.{" "}
          <Link href="/dashboard/pos">Open POS</Link>
        </p>
        <div className="stack">
          <div className="panel">
            <p className="panel-label">Catalog</p>
            {products.length ? (
              <ul className="row-list">
                {products.map((product) => (
                  <li key={product.id}>
                    <span>
                      {product.name}
                      <span className="muted">
                        {" "}
                        · Rs {product.unit_price}
                        {product.sku ? ` · ${product.sku}` : ""}
                      </span>
                    </span>
                    <span className="muted">
                      Stock {product.stock_on_hand}
                      {!product.is_active ? " · inactive" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No products yet</p>
            )}
          </div>
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
              {error ? <p className="form-error">{error}</p> : null}
              <button className="btn" type="submit" disabled={pending}>
                {pending ? "Saving…" : "Add product"}
              </button>
            </form>
          ) : null}
          {error && !canEditCatalog(user.role) ? <p className="form-error">{error}</p> : null}
        </div>
      </main>
    </div>
  );
}
