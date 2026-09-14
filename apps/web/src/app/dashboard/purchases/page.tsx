"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  ApiError,
  apiFetch,
  type Product,
  type PurchaseReceipt,
  type Supplier,
  type User,
} from "@/lib/api";
import { getStoredUser, getToken } from "@/lib/auth";

function canEdit(role: string): boolean {
  return role === "owner" || role === "manager" || role === "stock_keeper";
}

function canView(role: string): boolean {
  return canEdit(role) || role === "accountant";
}

export default function PurchasesPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [receipts, setReceipts] = useState<PurchaseReceipt[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitCost, setUnitCost] = useState("0");
  const [batchCode, setBatchCode] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function load(tokenValue: string) {
    const [nextSuppliers, nextProducts, nextReceipts] = await Promise.all([
      apiFetch<Supplier[]>("/v1/suppliers", { token: tokenValue }),
      apiFetch<Product[]>("/v1/products", { token: tokenValue }),
      apiFetch<PurchaseReceipt[]>("/v1/purchases/receipts", { token: tokenValue }),
    ]);
    setSuppliers(nextSuppliers);
    setProducts(nextProducts);
    setReceipts(nextReceipts);
    if (!supplierId && nextSuppliers[0]) setSupplierId(nextSuppliers[0].id);
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
      setError(err instanceof ApiError ? err.message : "Could not load purchases"),
    );
  }, [router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!token || !user || !canEdit(user.role) || !supplierId || !productId) return;
    setError("");
    setPending(true);
    try {
      await apiFetch<PurchaseReceipt>("/v1/purchases/receive", {
        method: "POST",
        token,
        body: JSON.stringify({
          supplier_id: supplierId,
          lines: [
            {
              product_id: productId,
              quantity,
              unit_cost: unitCost || "0",
              batch_code: batchCode || null,
              expiry_date: expiryDate || null,
            },
          ],
        }),
      });
      setQuantity("1");
      setBatchCode("");
      setExpiryDate("");
      await load(token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Receive failed");
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

  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? id;
  const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name ?? id;

  return (
    <div className="page">
      <main className="shell shell-wide">
        <p className="eyebrow">{user.tenant.name}</p>
        <h1>Purchases</h1>
        <p className="lede">
          Receive stock from suppliers. <Link href="/dashboard/suppliers">Suppliers</Link>
          {" · "}
          <Link href="/dashboard/inventory">Inventory</Link>
        </p>

        {canEdit(user.role) ? (
          <form className="panel form" onSubmit={onSubmit}>
            <p className="panel-label">Receive goods</p>
            <label>
              Supplier
              <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Product
              <select value={productId} onChange={(e) => setProductId(e.target.value)} required>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} (stock {product.stock_on_hand})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Quantity
              <input value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
            </label>
            <label>
              Unit cost
              <input value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
            </label>
            <label>
              Batch code (required if product tracks batches)
              <input value={batchCode} onChange={(e) => setBatchCode(e.target.value)} />
            </label>
            <label>
              Expiry date
              <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            <button className="btn" type="submit" disabled={pending || !suppliers.length || !products.length}>
              {pending ? "Receiving…" : "Receive into stock"}
            </button>
          </form>
        ) : error ? (
          <p className="form-error">{error}</p>
        ) : null}

        <div className="panel" style={{ marginTop: "1.25rem" }}>
          <p className="panel-label">Recent receipts</p>
          {receipts.length ? (
            <ul className="row-list">
              {receipts.map((receipt) => (
                <li key={receipt.id}>
                  <span>
                    {supplierName(receipt.supplier_id)}
                    <span className="muted">
                      {" "}
                      · {new Date(receipt.received_at).toLocaleString()} ·{" "}
                      {receipt.lines
                        .map((line) => `${productName(line.product_id)} × ${line.quantity}`)
                        .join(", ")}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No receipts yet</p>
          )}
        </div>
      </main>
    </div>
  );
}
