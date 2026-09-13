"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { clearSession, getStoredUser } from "@/lib/auth";
import type { User } from "@/lib/api";

export function SiteHeader() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  function signOut() {
    clearSession();
    setUser(null);
    window.location.href = "/";
  }

  return (
    <header className="topbar">
      <Link href="/" className="brand">
        SRD Biz
      </Link>
      <nav className="nav">
        {user ? (
          <>
            <Link href="/dashboard">Dashboard</Link>
            {user.role === "owner" || user.role === "manager" ? (
              <>
                <Link href="/dashboard/team">Team</Link>
                <Link href="/dashboard/branches">Branches</Link>
              </>
            ) : null}
            <button type="button" className="link-button" onClick={signOut}>
              Sign out
            </button>
          </>
        ) : (
          <>
            <Link href="/login">Sign in</Link>
            <Link href="/register" className="nav-cta">
              Create business
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
