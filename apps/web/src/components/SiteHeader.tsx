"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { SESSION_EVENT, clearSession, getStoredUser } from "@/lib/auth";
import type { User } from "@/lib/api";
import { homePathForUser } from "@/lib/roles";
import {
  hydrateSidebar,
  subscribeSidebar,
  toggleSidebar,
} from "@/lib/sidebar";
import { IconLogout } from "@/components/Icons";

export function SiteHeader() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const onDashboard = pathname.startsWith("/dashboard");

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
    setSidebarCollapsed(hydrateSidebar());
    return subscribeSidebar(setSidebarCollapsed);
  }, []);

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
  const homeHref = user ? homePathForUser(user) : "/";

  return (
    <header className="topbar" data-scrolled={scrolled ? "true" : "false"}>
      <Link href={homeHref} className="brand" title={user ? user.tenant.name : "BizNet"}>
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
            {onDashboard ? (
              <button
                type="button"
                className="user-toggle"
                onClick={() => toggleSidebar()}
                title={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
                aria-label={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
                aria-pressed={!sidebarCollapsed}
              >
                {user.full_name}
                <span className="user-toggle-hint">
                  {sidebarCollapsed ? "Show menu" : "Hide menu"}
                </span>
              </button>
            ) : (
              <span className="user-toggle" aria-hidden="true">
                {user.full_name}
              </span>
            )}
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
