"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import type { User } from "@/lib/api";
import { getStoredUser, getToken } from "@/lib/auth";

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const workspace = pathname.startsWith("/dashboard/pos") ? "pos" : "office";

  useEffect(() => {
    const token = getToken();
    const stored = getStoredUser();
    if (!token || !stored) {
      router.replace("/login");
      return;
    }
    setUser(stored);
  }, [router]);

  if (!user) {
    return (
      <div className="page">
        <main className="app-main">
          <p className="lede">Loading…</p>
        </main>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="app-frame" data-workspace={workspace}>
        <div className="app-main">{children}</div>
      </div>
    </div>
  );
}
