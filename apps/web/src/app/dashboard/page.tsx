"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { apiFetch, type Branch, type User } from "@/lib/api";
import { getStoredUser, getToken } from "@/lib/auth";

function canManage(role: string): boolean {
  return role === "owner" || role === "manager";
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);

  useEffect(() => {
    const token = getToken();
    const stored = getStoredUser();
    if (!token || !stored) {
      router.replace("/login");
      return;
    }
    setUser(stored);
    apiFetch<Branch[]>("/v1/branches", { token }).then(setBranches).catch(() => undefined);
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
          Signed in as {user.full_name} ({user.role.replaceAll("_", " ")}). Core auth is in
          place — POS is the next feature branch.
        </p>
        <div className="stack">
          <div className="panel">
            <p className="panel-label">Branches</p>
            <ul className="row-list">
              {(branches.length ? branches : user.branch ? [user.branch] : []).map((branch) => (
                <li key={branch.id}>
                  <span>{branch.name}</span>
                </li>
              ))}
            </ul>
            {canManage(user.role) ? (
              <p className="form-foot">
                <Link href="/dashboard/branches">Manage branches</Link>
              </p>
            ) : null}
          </div>
          {canManage(user.role) ? (
            <div className="panel">
              <p className="panel-label">Team</p>
              <p className="muted">Invite cashiers, stock keepers, and other roles with a join link.</p>
              <p className="form-foot">
                <Link href="/dashboard/team">Manage team</Link>
              </p>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
