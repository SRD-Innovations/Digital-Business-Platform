"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

import { SESSION_EVENT, clearSession, getStoredUser } from "@/lib/auth";
import type { User } from "@/lib/api";
import { isNavActive, moduleForPath, navForUser } from "@/lib/nav";
import { homePathForUser } from "@/lib/roles";
import { IconLogout } from "@/components/Icons";

function roleLabel(role: string): string {
  return role.replaceAll("_", " ");
}

export function SiteHeader() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    function refresh() {
      setUser(getStoredUser());
    }
    refresh();
    setReady(true);
    window.addEventListener(SESSION_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(SESSION_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [pathname]);

  const items = useMemo(() => (user ? navForUser(user) : []), [user]);
  const authed = ready && Boolean(user);

  function signOut() {
    clearSession();
    setUser(null);
    window.location.href = "/";
  }

  const brandLabel = user?.tenant.name?.trim() || "BizNet";
  const homeHref = user ? homePathForUser(user) : "/";

  return (
    <header
      className="topbar"
      data-authed={authed ? "true" : "false"}
      data-module={authed ? moduleForPath(pathname) : "none"}
    >
      <Link href={authed ? homeHref : "/"} className="brand" title={authed ? brandLabel : "BizNet"}>
        {authed ? (
          brandLabel
        ) : (
          <>
            Biz<span>Net</span>
          </>
        )}
      </Link>
      {authed && items.length ? (
        <nav className="appbar-nav" aria-label="Workspace">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="appbar-icon"
                title={item.label}
                aria-label={item.label}
                data-active={isNavActive(pathname, item.href) ? "true" : "false"}
                data-featured={item.featured ? "true" : "false"}
              >
                <Icon />
              </Link>
            );
          })}
        </nav>
      ) : null}
      <nav className="nav">
        {authed && user ? (
          <>
            <span className="user-chip">
              {user.full_name}
              <span className="user-chip-role">{roleLabel(user.role)}</span>
            </span>
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
        ) : ready ? (
          <>
            <Link href="/login" className="link-underline">
              Sign in
            </Link>
            <Link href="/#signup" className="nav-cta">
              Create business
            </Link>
          </>
        ) : null}
      </nav>
    </header>
  );
}
