"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { apiFetch, type Branch, type User } from "@/lib/api";
import { getStoredUser, getToken } from "@/lib/auth";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getToken();
    const stored = getStoredUser();
    if (!token || !stored) {
      router.replace("/login");
      return;
    }
    setUser(stored);
    apiFetch<Branch[]>("/v1/branches", { token })
      .then(setBranches)
      .catch(() => setError("Could not load branches. Check that the API is awake."));
  }, [router]);

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
        <h1>Dashboard</h1>
        <p className="lede">
          Signed in as {user.full_name} ({user.role}). This is the core platform shell —
          POS and stock come next.
        </p>
        <div className="panel">
          <p className="panel-label">Branches</p>
          {error ? <p className="form-error">{error}</p> : null}
          <ul>
            {branches.length
              ? branches.map((branch) => <li key={branch.id}>{branch.name}</li>)
              : user.branch
                ? <li>{user.branch.name}</li>
                : <li>No branches yet</li>}
          </ul>
        </div>
      </main>
    </div>
  );
}
