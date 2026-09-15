"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ApiError, apiFetch, type Bom, type Product, type ProductionRun, type User } from "@/lib/api";
import { getStoredUser, getToken } from "@/lib/auth";

function canEdit(role: string): boolean {
  return role === "owner" || role === "manager" || role === "production_staff" || role === "stock_keeper";
}

function canView(role: string): boolean {
  return canEdit(role) || role === "accountant";
}

export default function ManufacturingPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [boms, setBoms] = useState<Bom[]>([]);
  const [runs, setRuns] = useState<ProductionRun[]>([]);
  const [name, setName] = useState("");
  const [finishedId, setFinishedId] = useState("");
  const [componentId, setComponentId] = useState("");
  const [qtyPer, setQtyPer] = useState("1");
  const [yieldPct, setYieldPct] = useState("100");
  const [bomId, setBomId] = useState("");
  const [planned, setPlanned] = useState("10");
  const [actual, setActual] = useState("10");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function load(tokenValue: string) {
    const [nextProducts, nextBoms, nextRuns] = await Promise.all([
      apiFetch<Product[]>("/v1/products", { token: tokenValue }),
      apiFetch<Bom[]>("/v1/boms", { token: tokenValue }),
      apiFetch<ProductionRun[]>("/v1/production/runs", { token: tokenValue }),
    ]);
    setProducts(nextProducts);
    setBoms(nextBoms);
    setRuns(nextRuns);
    if (!finishedId && nextProducts[0]) setFinishedId(nextProducts[0].id);
    if (!componentId && nextProducts[1]) setComponentId(nextProducts[1].id);
    else if (!componentId && nextProducts[0]) setComponentId(nextProducts[0].id);
    if (!bomId && nextBoms[0]) setBomId(nextBoms[0].id);
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
      setError(err instanceof ApiError ? err.message : "Could not load manufacturing"),
    );
  }, [router]);

  async function createBom(event: FormEvent) {
    event.preventDefault();
    if (!token || !canEdit(user?.role ?? "")) return;
    setPending(true);
    setError("");
    try {
      await apiFetch<Bom>("/v1/boms", {
        method: "POST",
        token,
        body: JSON.stringify({
          name,
          finished_product_id: finishedId,
          expected_yield_pct: yieldPct,
          lines: [{ component_product_id: componentId, quantity_per_output: qtyPer }],
        }),
      });
      setName("");
      await load(token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create BOM");
    } finally {
      setPending(false);
    }
  }

  async function runProduction(event: FormEvent) {
    event.preventDefault();
    if (!token || !canEdit(user?.role ?? "") || !bomId) return;
    setPending(true);
    setError("");
    try {
      await apiFetch<ProductionRun>("/v1/production/runs", {
        method: "POST",
        token,
        body: JSON.stringify({
          bom_id: bomId,
          planned_output_qty: planned,
          actual_output_qty: actual,
        }),
      });
      await load(token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Production run failed");
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
        <div className="page-head">
          <p className="eyebrow">{user.tenant.name}</p>
          <h1>Manufacturing</h1>
          <p className="lede">
            Raw materials feed one finished good. Yield and wastage stay visible on every run.{" "}
            <Link href="/dashboard/inventory">Inventory</Link>
          </p>
        </div>

        {error ? <p className="form-error">{error}</p> : null}

        {canEdit(user.role) ? (
          <form className="panel form" onSubmit={createBom}>
            <p className="panel-label">New BOM</p>
            <label>
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label>
              Finished product
              <select value={finishedId} onChange={(e) => setFinishedId(e.target.value)}>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Component
              <select value={componentId} onChange={(e) => setComponentId(e.target.value)}>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} (stock {product.stock_on_hand})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Qty component per 1 finished
              <input value={qtyPer} onChange={(e) => setQtyPer(e.target.value)} required />
            </label>
            <label>
              Expected yield %
              <input value={yieldPct} onChange={(e) => setYieldPct(e.target.value)} required />
            </label>
            <button className="btn" type="submit" disabled={pending || products.length < 2}>
              Save BOM
            </button>
          </form>
        ) : null}

        <div className="panel" style={{ marginTop: 12 }}>
          <p className="panel-label">BOMs</p>
          {boms.length ? (
            <div className="bom-flow">
              {boms.map((bom) => (
                <div key={bom.id} className="bom-flow-row">
                  <span>
                    {bom.lines
                      .map((line) => `${productName(line.component_product_id)} × ${line.quantity_per_output}`)
                      .join(", ") || "No components"}
                    <span className="bom-arrow"> → </span>
                    <strong>{productName(bom.finished_product_id)}</strong>
                    <span className="muted"> · {bom.name}</span>
                  </span>
                  <span className="badge badge-manufacturing">Yield {bom.expected_yield_pct}%</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">No BOMs yet</p>
          )}
        </div>

        {canEdit(user.role) ? (
          <form className="panel form" style={{ marginTop: 12 }} onSubmit={runProduction}>
            <p className="panel-label">Run production</p>
            <label>
              BOM
              <select value={bomId} onChange={(e) => setBomId(e.target.value)}>
                {boms.map((bom) => (
                  <option key={bom.id} value={bom.id}>
                    {bom.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Planned output qty
              <input value={planned} onChange={(e) => setPlanned(e.target.value)} required />
            </label>
            <label>
              Actual output qty
              <input value={actual} onChange={(e) => setActual(e.target.value)} required />
            </label>
            <button className="btn" type="submit" disabled={pending || !boms.length}>
              Complete run
            </button>
          </form>
        ) : null}

        <div className="panel" style={{ marginTop: 12 }}>
          <p className="panel-label">Recent runs</p>
          {runs.length ? (
            <div className="stack">
              {runs.map((run) => (
                <div key={run.id}>
                  <p style={{ margin: "0 0 8px" }}>
                    <strong>{productName(run.finished_product_id)}</strong>
                    <span className="muted">
                      {" "}
                      · {run.actual_output_qty}/{run.planned_output_qty} · Rs {run.unit_cost}/unit
                    </span>
                  </p>
                  <div className="yield-pair">
                    <div className="yield-stat" data-tone="success">
                      <span>Yield</span>
                      <p className="display-num" style={{ margin: 0 }}>
                        {run.yield_pct}%
                      </p>
                    </div>
                    <div className="yield-stat" data-tone="danger">
                      <span>Wastage</span>
                      <p className="display-num" style={{ margin: 0 }}>
                        {run.wastage_pct}%
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">No runs yet</p>
          )}
        </div>
      </main>
  );
}
