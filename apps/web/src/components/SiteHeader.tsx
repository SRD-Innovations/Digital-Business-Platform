"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { clearSession, getStoredUser } from "@/lib/auth";
import type { User } from "@/lib/api";

export function SiteHeader() {
  const [user, setUser] = useState<User | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setUser(getStoredUser());
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function signOut() {
    clearSession();
    setUser(null);
    window.location.href = "/";
  }

  return (
    <header className="topbar" data-scrolled={scrolled ? "true" : "false"}>
      <Link href={user ? "/dashboard" : "/"} className="brand">
        SRD <span>Biz</span>
      </Link>
      <nav className="nav">
        {user ? (
          <>
            <span className="user-chip" title={user.tenant.name}>
              {user.full_name}
            </span>
            <Link href="/dashboard">Home</Link>
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
