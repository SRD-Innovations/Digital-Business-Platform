"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { SESSION_EVENT, clearSession, getStoredUser } from "@/lib/auth";
import type { User } from "@/lib/api";
import { IconHome, IconLogout } from "@/components/Icons";

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
        {user ? (
          brandLabel
        ) : (
          <>
            Biz<span>Net</span>
          </>
        )}
      </Link>
      <nav className="nav">
        {user ? (
          <>
            <Link
              href="/dashboard"
              className="icon-btn"
              title="Home"
              aria-label="Home"
            >
              <IconHome />
            </Link>
            <button
              type="button"
              className="icon-btn"
              onClick={signOut}
              title="Sign out"
              aria-label="Sign out"
            >
              <IconLogout />
            </button>
          </>
        ) : (
          <>
            <Link href="/login" className="link-underline">
              Sign in
            </Link>
            <Link href="/#signup" className="link-underline link-underline-accent">
              Create business
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
