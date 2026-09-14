"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ApiError, apiFetch, type AdminTenant, type User } from "@/lib/api";
import { getStoredUser, getToken } from "@/lib/auth";

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [tenants, setTenants] = useState<AdminTenant[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getToken();
    const stored = getStoredUser();
    if (!token || !stored) {
      router.replace("/login");
      return;
    }
    if (!stored.is_platform_admin) {
      router.replace("/dashboard");
      return;
    }
    setUser(stored);
    apiFetch<AdminTenant[]>("/v1/admin/tenants", { token })
      .then(setTenants)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load tenants"));
  }, [router]);

  if (!user) {
    return <p className="lede">Loading…</p>;
  }

  return (
    <main className="shell shell-wide">
        <p className="eyebrow">Platform</p>
        <h1>Admin</h1>
        <p className="lede">
          Tenant and subscription overview. <Link href="/dashboard/billing">Billing</Link>
        </p>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="panel">
          <p className="panel-label">Tenants</p>
          {tenants.length ? (
            <ul className="row-list">
              {tenants.map((tenant) => (
                <li key={tenant.id}>
                  <span>
                    {tenant.name}
                    <span className="muted"> · {tenant.slug}</span>
                  </span>
                  <span className="muted">
                    {tenant.plan_code ?? "—"} / {tenant.subscription_status ?? "none"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No tenants</p>
          )}
        </div>
      </main>
  );
}
