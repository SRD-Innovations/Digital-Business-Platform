"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { ApiError, apiFetch, type Tenant, type User } from "@/lib/api";
import { getStoredUser, getToken, setStoredUser } from "@/lib/auth";

function canManage(role: string): boolean {
  return role === "owner" || role === "manager";
}

type FormState = {
  name: string;
  legal_name: string;
  address_line1: string;
  address_line2: string;
  city: string;
  phone: string;
  email: string;
  tin: string;
  vat_number: string;
};

function fromTenant(tenant: Tenant): FormState {
  return {
    name: tenant.name ?? "",
    legal_name: tenant.legal_name ?? "",
    address_line1: tenant.address_line1 ?? "",
    address_line2: tenant.address_line2 ?? "",
    city: tenant.city ?? "",
    phone: tenant.phone ?? "",
    email: tenant.email ?? "",
    tin: tenant.tin ?? "",
    vat_number: tenant.vat_number ?? "",
  };
}

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const storedToken = getToken();
    const stored = getStoredUser();
    if (!storedToken || !stored) {
      router.replace("/login");
      return;
    }
    if (!canManage(stored.role)) {
      router.replace("/dashboard");
      return;
    }
    setUser(stored);
    setToken(storedToken);
    setForm(fromTenant(stored.tenant));
    apiFetch<Tenant>("/v1/tenant", { token: storedToken })
      .then((tenant) => {
        setForm(fromTenant(tenant));
        const nextUser = { ...stored, tenant };
        setUser(nextUser);
        setStoredUser(nextUser);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load settings"));
  }, [router]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !form || !user) return;
    setPending(true);
    setError("");
    setMessage("");
    try {
      const tenant = await apiFetch<Tenant>("/v1/tenant", {
        method: "PATCH",
        token,
        body: JSON.stringify(form),
      });
      const nextUser = { ...user, tenant };
      setUser(nextUser);
      setStoredUser(nextUser);
      setForm(fromTenant(tenant));
      setMessage("Business profile saved. Receipts will use these details.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save settings");
    } finally {
      setPending(false);
    }
  }

  if (!user || !form) {
    return <p className="lede">Loading…</p>;
  }

  return (
    <main className="shell">
        <p className="eyebrow">{user.tenant.name}</p>
        <h1>Business settings</h1>
        <p className="lede">
          TIN, VAT, and address for English receipts.{" "}
          <Link href="/dashboard">Dashboard</Link>
        </p>

        {error ? <p className="form-error">{error}</p> : null}
        {message ? <p className="muted">{message}</p> : null}

        <form className="panel form" onSubmit={onSubmit}>
          <label>
            Trading name
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              minLength={2}
            />
          </label>
          <label>
            Legal name (optional)
            <input
              value={form.legal_name}
              onChange={(e) => setForm({ ...form, legal_name: e.target.value })}
              placeholder="As on IRD registration"
            />
          </label>
          <label>
            Address line 1
            <input
              value={form.address_line1}
              onChange={(e) => setForm({ ...form, address_line1: e.target.value })}
            />
          </label>
          <label>
            Address line 2
            <input
              value={form.address_line2}
              onChange={(e) => setForm({ ...form, address_line2: e.target.value })}
            />
          </label>
          <label>
            City
            <input
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
          </label>
          <label>
            Phone
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label>
            TIN
            <input
              value={form.tin}
              onChange={(e) => setForm({ ...form, tin: e.target.value })}
              placeholder="Taxpayer Identification Number"
            />
          </label>
          <label>
            VAT number
            <input
              value={form.vat_number}
              onChange={(e) => setForm({ ...form, vat_number: e.target.value })}
              placeholder="Leave blank if not VAT-registered"
            />
          </label>
          <button className="btn" type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save profile"}
          </button>
        </form>
      </main>
  );
}
