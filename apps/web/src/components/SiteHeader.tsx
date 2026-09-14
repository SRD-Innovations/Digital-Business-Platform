"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { SESSION_EVENT, clearSession, getStoredUser } from "@/lib/auth";
import type { User } from "@/lib/api";

export function SiteHeader() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function refresh() {
      setUser(getStoredUser());
    }
    refresh();
    window.addEventListener(SESSION_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(SESSION_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [pathname]);

  useEffect(() => {
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

  const brandLabel = user?.tenant.name?.trim() || "BizNet";

  return (
    <header className="topbar" data-scrolled={scrolled ? "true" : "false"}>
      <Link
        href={user ? "/dashboard" : "/"}
        className="brand"
        title={user ? user.tenant.name : "BizNet"}
      >
        {user ? brandLabel : (
          <>
            Biz<span>Net</span>
          </>
        )}
      </Link>
      <nav className="nav">
        {user ? (
          <>
            <span className="user-chip" title={user.full_name}>
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
            <Link href="/#signup" className="btn nav-cta">
              Create business
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
