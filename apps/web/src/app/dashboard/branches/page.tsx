"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ApiError, apiFetch, type Branch, type User } from "@/lib/api";
import { getStoredUser, getToken } from "@/lib/auth";

export default function BranchesPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const storedToken = getToken();
    const stored = getStoredUser();
    if (!storedToken || !stored) {
      router.replace("/login");
      return;
    }
    if (stored.role !== "owner" && stored.role !== "manager") {
      router.replace("/dashboard");
      return;
    }
    setUser(stored);
    setToken(storedToken);
    apiFetch<Branch[]>("/v1/branches", { token: storedToken })
      .then(setBranches)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load branches"));
  }, [router]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setError("");
    setPending(true);
    const form = event.currentTarget;
    const name = String(new FormData(form).get("name") ?? "");
    try {
      const created = await apiFetch<Branch>("/v1/branches", {
        method: "POST",
        token,
        body: JSON.stringify({ name }),
      });
      setBranches((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      form.reset();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create branch");
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
      <main className="shell">
        <p className="eyebrow">{user.tenant.name}</p>
        <h1>Branches</h1>
        <p className="lede">Stock and staff will be scoped to a branch. Main was created at signup.</p>
        <div className="stack">
          <div className="panel">
            <p className="panel-label">Current</p>
            <ul className="row-list">
              {branches.map((branch) => (
                <li key={branch.id}>
                  <span>{branch.name}</span>
                </li>
              ))}
            </ul>
          </div>
          <form className="panel form" onSubmit={onSubmit}>
            <p className="panel-label">Add branch</p>
            <label>
              Name
              <input name="name" required minLength={2} placeholder="Kandy" />
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            <button className="btn" type="submit" disabled={pending}>
              {pending ? "Saving…" : "Add branch"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
