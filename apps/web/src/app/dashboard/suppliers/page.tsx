"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ApiError, apiFetch, type Supplier, type User } from "@/lib/api";
import { getStoredUser, getToken } from "@/lib/auth";

function canEdit(role: string): boolean {
  return role === "owner" || role === "manager" || role === "stock_keeper";
}

function canView(role: string): boolean {
  return canEdit(role) || role === "accountant";
}

export default function SuppliersPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

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
    apiFetch<Supplier[]>("/v1/suppliers?active_only=false", { token: storedToken })
      .then(setSuppliers)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load suppliers"));
  }, [router]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !user || !canEdit(user.role)) return;
    setError("");
    setPending(true);
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const created = await apiFetch<Supplier>("/v1/suppliers", {
        method: "POST",
        token,
        body: JSON.stringify({
          name: data.get("name"),
          phone: data.get("phone") || null,
          email: data.get("email") || null,
          note: data.get("note") || null,
        }),
      });
      setSuppliers((current) => [created, ...current].sort((a, b) => a.name.localeCompare(b.name)));
      form.reset();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create supplier");
    } finally {
      setPending(false);
    }
  }

  if (!user) {
    return <p className="lede">Loading…</p>;
  }

  return (
    <main className="shell">
        <p className="eyebrow">{user.tenant.name}</p>
        <h1>Suppliers</h1>
        <p className="lede">
          Who you buy stock from. <Link href="/dashboard/purchases">Receive purchases</Link>
        </p>

        {canEdit(user.role) ? (
          <form className="panel form" onSubmit={onSubmit}>
            <p className="panel-label">Add supplier</p>
            <label>
              Name
              <input name="name" required />
            </label>
            <label>
              Phone
              <input name="phone" />
            </label>
            <label>
              Email
              <input name="email" type="email" />
            </label>
            <label>
              Note
              <input name="note" />
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            <button className="btn" type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save supplier"}
            </button>
          </form>
        ) : error ? (
          <p className="form-error">{error}</p>
        ) : null}

        <div className="panel" style={{ marginTop: "1.25rem" }}>
          <p className="panel-label">Directory</p>
          {suppliers.length ? (
            <ul className="row-list">
              {suppliers.map((supplier) => (
                <li key={supplier.id}>
                  <span>
                    {supplier.name}
                    {!supplier.is_active ? <span className="muted"> · inactive</span> : null}
                    {supplier.phone ? <span className="muted"> · {supplier.phone}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No suppliers yet</p>
          )}
        </div>
      </main>
  );
}
